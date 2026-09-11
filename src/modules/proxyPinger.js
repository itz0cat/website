import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROXIES_FILE = path.join(__dirname, '../../proxies.txt');

const PING_ENDPOINT = 'https://api.fastclient.net/api/fastclient/ping';
const USER_AGENT = 'FastClient/1.21.11';
const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_COOLDOWN_MS = 300000; // 5 minutes

const PROXY_SOURCES = [
  'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
  'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt',
  'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
  'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt'
];

// Sequential Base-63 Minecraft Username Generator (matching gen.py)
// Sequence: AAA, AAB, AAC ... length-3 up to length-16
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
const BASE = BigInt(ALPHABET.length); // 63
const MIN_LEN = 3;
const MAX_LEN = 16;

const COUNTS_PER_LEN = {};
const CUM_OFFSETS = {};
let runningCombinations = 0n;
for (let n = MIN_LEN; n <= MAX_LEN; n++) {
  COUNTS_PER_LEN[n] = BASE ** BigInt(n);
  CUM_OFFSETS[n] = runningCombinations;
  runningCombinations += COUNTS_PER_LEN[n];
}
const TOTAL_COMBINATIONS = runningCombinations;

export function indexToUsername(index) {
  let idx = BigInt(index);
  if (idx < 0n || idx >= TOTAL_COMBINATIONS) {
    throw new Error('Index out of range');
  }

  for (let n = MIN_LEN; n <= MAX_LEN; n++) {
    const bucketSize = COUNTS_PER_LEN[n];
    const offset = CUM_OFFSETS[n];
    if (idx < offset + bucketSize) {
      let localIndex = idx - offset;
      const digits = [];
      for (let i = 0; i < n; i++) {
        const rem = Number(localIndex % BASE);
        localIndex = localIndex / BASE;
        digits.push(ALPHABET[rem]);
      }
      return digits.reverse().join('');
    }
  }
  return 'AAA';
}

class UsernameLedger {
  constructor(filePath) {
    this.filePath = filePath;
    this.currentIndex = 0n;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8').trim();
        if (raw) this.currentIndex = BigInt(raw);
      }
    } catch {}
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, this.currentIndex.toString(), 'utf-8');
    } catch {}
  }

  next() {
    const name = indexToUsername(this.currentIndex);
    this.currentIndex++;
    this.save();
    return name;
  }
}

const LEDGER_FILE = path.join(__dirname, '../../username_ledger.txt');
export const usernameLedger = new UsernameLedger(LEDGER_FILE);

function getProxyAgent(proxyUrl) {
  if (!proxyUrl) return null;
  if (proxyUrl.startsWith('socks')) {
    return new SocksProxyAgent(proxyUrl);
  }
  return new HttpsProxyAgent(proxyUrl);
}

class ProxyNode {
  constructor(url) {
    this.url = url;
    this.masked = url.replace(/:\/\/[^:@]+:[^@]+@/, '://***:***@').replace(/http:\/\//, '').replace(/https:\/\//, '').replace(/socks5:\/\//, 's5://');
    this.cooldownUntil = 0;
    this.consecutiveFailures = 0;
    this.isDead = false;
    this.successCount = 0;
    this.rateLimitedCount = 0;
  }

  get isReady() {
    return !this.isDead && Date.now() >= this.cooldownUntil;
  }

  get remainingCooldownSec() {
    return Math.max(0, (this.cooldownUntil - Date.now()) / 1000);
  }
}

class BatchProxyPool {
  constructor() {
    this.proxies = [];
    this.testedCandidates = new Set();
    this.currentIndex = 0;
    this.isScraping = false;
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(PROXIES_FILE)) {
        const lines = fs.readFileSync(PROXIES_FILE, 'utf-8').split('\n');
        for (let line of lines) {
          line = line.trim();
          if (line && !line.startsWith('#')) {
            const formatted = this.formatProxyLine(line);
            if (formatted && !this.proxies.some(p => p.url === formatted)) {
              this.proxies.push(new ProxyNode(formatted));
              this.testedCandidates.add(formatted);
            }
          }
        }
      }
    } catch {}
  }

  saveToDisk() {
    try {
      const active = this.proxies.filter(p => !p.isDead).map(p => p.url);
      fs.writeFileSync(PROXIES_FILE, active.join('\n') + '\n', 'utf-8');
    } catch {}
  }

  formatProxyLine(line) {
    if (line.includes('://')) return line;
    const parts = line.split(':');
    if (parts.length === 2) return `http://${parts[0]}:${parts[1]}`;
    if (parts.length === 4) return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
    return null;
  }

  addProxy(rawUrl) {
    const formatted = this.formatProxyLine(rawUrl);
    if (!formatted) return false;
    if (this.proxies.some(p => p.url === formatted)) return false;
    this.proxies.push(new ProxyNode(formatted));
    this.testedCandidates.add(formatted);
    return true;
  }

  get totalCount() {
    return this.proxies.length;
  }

  get readyCount() {
    return this.proxies.filter(p => p.isReady).length;
  }

  get inCooldownCount() {
    const now = Date.now();
    return this.proxies.filter(p => !p.isDead && p.cooldownUntil > now).length;
  }

  getReadyProxy() {
    if (this.proxies.length === 0) return null;
    const n = this.proxies.length;
    const start = this.currentIndex;

    for (let i = 0; i < n; i++) {
      const idx = (start + i) % n;
      const candidate = this.proxies[idx];
      if (candidate.isReady) {
        this.currentIndex = (idx + 1) % n;
        return candidate;
      }
    }
    return null;
  }

  getFirstCooldownProxy() {
    const alive = this.proxies.filter(p => !p.isDead);
    if (alive.length === 0) return null;
    return alive.reduce((earliest, p) => (p.cooldownUntil < earliest.cooldownUntil ? p : earliest), alive[0]);
  }

  async scrapeAndValidateBatch(batchSize = 250, onProgress = null) {
    if (this.isScraping) return 0;
    this.isScraping = true;

    try {
      if (onProgress) onProgress(`Scraping fresh candidate proxies from sources...`);
      const candidates = new Set();

      for (const src of PROXY_SOURCES) {
        try {
          const res = await fetch(src, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const text = await res.text();
            for (const raw of text.split('\n')) {
              const line = raw.trim();
              if (line && !line.startsWith('#') && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}$/.test(line)) {
                const pUrl = `http://${line}`;
                if (!this.testedCandidates.has(pUrl)) {
                  candidates.add(pUrl);
                }
              }
            }
          }
        } catch {}
        if (candidates.size >= batchSize) break;
      }

      const list = Array.from(candidates).slice(0, batchSize);
      if (list.length === 0) {
        this.testedCandidates.clear();
        return 0;
      }

      if (onProgress) onProgress(`Validating ${list.length} candidates against API...`);
      let found = 0;
      let tested = 0;

      // Validate in parallel chunks of 20
      const CHUNK_SIZE = 20;
      for (let i = 0; i < list.length; i += CHUNK_SIZE) {
        const chunk = list.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
          chunk.map(async pUrl => {
            this.testedCandidates.add(pUrl);
            const ok = await this.testCandidate(pUrl);
            return { pUrl, ok };
          })
        );

        for (const { pUrl, ok } of results) {
          tested++;
          if (ok) {
            if (this.addProxy(pUrl)) {
              found++;
              this.saveToDisk();
            }
          }
        }

        if (onProgress) onProgress(`Tested [${tested}/${list.length}] | +${found} working proxies added`);
      }

      this.saveToDisk();
      return found;
    } finally {
      this.isScraping = false;
    }
  }

  testCandidate(proxyUrl) {
    return new Promise(resolve => {
      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(val);
      };

      const timer = setTimeout(() => {
        try { req.destroy(); } catch {}
        finish(false);
      }, 5000);

      let req;
      try {
        const agent = getProxyAgent(proxyUrl);
        const payload = JSON.stringify({ username: 'ProbeCheck' });

        req = https.request(
          PING_ENDPOINT,
          {
            method: 'POST',
            agent,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': USER_AGENT,
              'Content-Length': Buffer.byteLength(payload)
            }
          },
          res => {
            res.resume();
            finish(res.statusCode === 200 || res.statusCode === 429);
          }
        );

        req.on('error', () => finish(false));
        req.write(payload);
        req.end();
      } catch {
        finish(false);
      }
    });
  }
}

class ProxyPingerService {
  constructor() {
    this.pool = new BatchProxyPool();
    this.enabled = process.env.FASTCLIENT_PROXY_PINGER !== 'false';
    this.intervalMs = parseInt(process.env.PROXY_PING_INTERVAL_MS || '1500', 10);
    this.running = false;
    this.loopPromise = null;

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      otherErrors: 0,
      lastPingTime: null,
      lastTarget: null,
      lastStatusCode: null,
      lastProxyMasked: 'NONE',
      lastLatencyMs: 0,
      statusMessage: 'INITIALIZING',
      startedAt: null
    };
  }

  sendPingRequest(proxyNode, username) {
    return new Promise(resolve => {
      const startTime = Date.now();
      const payload = JSON.stringify({ username });
      let settled = false;

      const finish = (resObj) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(resObj);
      };

      let req;
      const timer = setTimeout(() => {
        try { if (req) req.destroy(); } catch {}
        finish({
          success: false,
          statusCode: null,
          error: 'Connection timeout',
          latency: Date.now() - startTime
        });
      }, REQUEST_TIMEOUT_MS);

      try {
        const agent = getProxyAgent(proxyNode.url);
        req = https.request(
          PING_ENDPOINT,
          {
            method: 'POST',
            agent,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': USER_AGENT,
              'Content-Length': Buffer.byteLength(payload)
            }
          },
          res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              finish({
                success: res.statusCode === 200,
                statusCode: res.statusCode,
                headers: res.headers,
                latency: Date.now() - startTime,
                body: data
              });
            });
          }
        );

        req.on('error', err => {
          finish({
            success: false,
            statusCode: null,
            error: err.message,
            latency: Date.now() - startTime
          });
        });

        req.write(payload);
        req.end();
      } catch (err) {
        finish({
          success: false,
          statusCode: null,
          error: err.message,
          latency: Date.now() - startTime
        });
      }
    });
  }

  async runLoop() {
    console.log('[ProxyPinger] 24/7 background proxy ping loop started.');
    this.stats.statusMessage = 'RUNNING';

    // Startup harvest if pool has fewer than 5 proxies
    if (this.pool.readyCount < 5) {
      console.log('[ProxyPinger] Startup: Harvesting initial proxy pool...');
      await this.pool.scrapeAndValidateBatch(250, msg => {
        this.stats.statusMessage = msg;
      });
    }

    let cycleCount = 0;
    while (this.running) {
      try {
        let proxy = this.pool.getReadyProxy();

        // THE IF STATEMENT: All proxies in cooldown?
        if (!proxy) {
          const firstProxy = this.pool.getFirstCooldownProxy();

          // Check: Is cooldown for first proxy up?
          if (firstProxy && firstProxy.remainingCooldownSec <= 1) {
            const waitMs = Math.max(100, Math.floor(firstProxy.remainingCooldownSec * 1000));
            this.stats.statusMessage = `Reusing proxy (${(waitMs / 1000).toFixed(1)}s cooldown left)...`;
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          } else {
            // Cooldown is NOT up -> Scrape 250 new proxies immediately!
            const remSec = firstProxy ? firstProxy.remainingCooldownSec.toFixed(0) : 'N/A';
            console.log(`[ProxyPinger] All proxies in cooldown or dead (${remSec}s remaining). Scraping fresh batch...`);
            this.stats.statusMessage = `All proxies busy (${remSec}s). Scraping 250 fresh candidates...`;

            await this.pool.scrapeAndValidateBatch(250, msg => {
              this.stats.statusMessage = msg;
            });

            // If still no ready proxy after scraping, wait for earliest cooldown
            if (this.pool.readyCount === 0) {
              const earliest = this.pool.getFirstCooldownProxy();
              const sleepSec = earliest ? Math.min(30, earliest.remainingCooldownSec) : 10;
              this.stats.statusMessage = `Waiting ${sleepSec.toFixed(1)}s for proxy cooldown...`;
              await new Promise(r => setTimeout(r, sleepSec * 1000));
            }
            continue;
          }
        }

        // Active ready proxy found (sequential base-63 username: AAA, AAB, AAC...)
        const username = usernameLedger.next();
        this.stats.lastTarget = username;
        this.stats.lastProxyMasked = proxy.masked;
        this.stats.statusMessage = `Pinging via ${proxy.masked}...`;

        const res = await this.sendPingRequest(proxy, username);
        this.stats.totalRequests++;
        this.stats.lastPingTime = new Date().toISOString();
        this.stats.lastStatusCode = res.statusCode || res.error;
        this.stats.lastLatencyMs = res.latency;
        cycleCount++;

        if (res.statusCode === 200) {
          this.stats.successfulRequests++;
          proxy.successCount++;
          proxy.consecutiveFailures = 0;
          this.stats.statusMessage = `OK (200) via ${proxy.masked} (${res.latency}ms)`;
          console.log(`[ProxyPinger] OK (200) -> "${username}" via ${proxy.masked} (${res.latency}ms) | Total: ${this.stats.totalRequests}, Success: ${this.stats.successfulRequests}, 429: ${this.stats.rateLimitedRequests}`);
          await new Promise(r => setTimeout(r, this.intervalMs));
        } else if (res.statusCode === 429) {
          this.stats.rateLimitedRequests++;
          proxy.rateLimitedCount++;
          proxy.cooldownUntil = Date.now() + DEFAULT_COOLDOWN_MS;
          this.stats.statusMessage = `429 Rate Limit on ${proxy.masked} -> Cooldown 300s`;
          console.log(`[ProxyPinger] 429 RateLimit on ${proxy.masked} -> Cooldown 300s`);
          // Rotate immediately to next proxy without pause
        } else {
          this.stats.otherErrors++;
          proxy.consecutiveFailures++;
          if (proxy.consecutiveFailures >= 3) {
            proxy.isDead = true;
          }
          this.stats.statusMessage = `Error (${res.error || res.statusCode}) on ${proxy.masked}`;
          if (cycleCount % 10 === 0) {
            console.log(`[ProxyPinger Pool] Requests: ${this.stats.totalRequests} | OK: ${this.stats.successfulRequests} | 429s: ${this.stats.rateLimitedRequests} | Pool Ready: ${this.pool.readyCount}, Cooldown: ${this.pool.inCooldownCount}`);
          }
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        console.error('[ProxyPinger] Loop error:', err.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    this.stats.statusMessage = 'STOPPED';
    console.log('[ProxyPinger] Background loop stopped.');
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.stats.startedAt = new Date().toISOString();
    this.loopPromise = this.runLoop();
  }

  stop() {
    this.running = false;
  }

  getStatus() {
    return {
      service: 'FastClient 24/7 Proxy Pinger',
      running: this.running,
      ledger: {
        currentIndex: usernameLedger.currentIndex.toString(),
        nextUsername: indexToUsername(usernameLedger.currentIndex)
      },
      stats: this.stats,
      pool: {
        total: this.pool.totalCount,
        ready: this.pool.readyCount,
        inCooldown: this.pool.inCooldownCount
      }
    };
  }
}

export const proxyPingerService = new ProxyPingerService();
