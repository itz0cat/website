import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { initDbState, getDbValue, setDbValue, saveWorkingProxiesToDb, getWorkingProxiesFromDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROXIES_FILE = path.join(__dirname, '../../proxies.txt');

const PING_ENDPOINT = 'https://api.fastclient.net/api/fastclient/ping';
const USER_AGENT = 'FastClient/1.21.11';
const REQUEST_TIMEOUT_MS = 4000;
const DEFAULT_COOLDOWN_MS = 300000; // 5 minutes

const PROXY_SOURCES = [
  'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
  'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt',
  'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
  'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
  'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
  'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
  'https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/http.txt',
  'https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/https.txt',
  'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt',
  'https://raw.githubusercontent.com/zevtyardt/proxy-list/main/http.txt'
];

// Sequential Base-37 Minecraft Username Generator (case-insensitive: a-z, 0-9, _)
// Sequence: aaa, aab, aac ... length-3 up to length-16
// Avoids redundant requests since Minecraft usernames are case-insensitive (cat == CAT == cAT)
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789_';
const BASE = BigInt(ALPHABET.length); // 37
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
  return 'aaa';
}

class UsernameLedger {
  constructor(filePath) {
    this.filePath = filePath;
    this.currentIndex = 0n;
    this.retryQueue = [];
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8').trim();
        if (raw) this.currentIndex = BigInt(raw);
      }
    } catch {}
  }

  async syncWithDb() {
    try {
      await initDbState();
      const alphabetVersion = await getDbValue('alphabet_version');
      if (alphabetVersion !== 'base37_v1') {
        // Upgrade to Base-37 case-insensitive alphabet: Start fresh from index 0 ("aaa")
        this.currentIndex = 0n;
        await setDbValue('current_index', '0');
        await setDbValue('alphabet_version', 'base37_v1');
        console.log(`[Ledger] Upgraded to Base-37 case-insensitive alphabet! Index reset to 0 ("aaa").`);
      } else {
        const dbVal = await getDbValue('current_index');
        if (dbVal !== null && dbVal !== undefined) {
          const dbIndex = BigInt(dbVal);
          if (dbIndex > this.currentIndex) {
            this.currentIndex = dbIndex;
            console.log(`[Ledger] Resumed index ${this.currentIndex} ("${indexToUsername(this.currentIndex)}") from PostgreSQL database!`);
          }
        }
      }
    } catch (err) {
      console.warn('[Ledger] DB sync warning:', err.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, this.currentIndex.toString(), 'utf-8');
    } catch {}
    setDbValue('current_index', this.currentIndex.toString()).catch(() => {});
  }

  acquireNext() {
    if (this.retryQueue.length > 0) {
      return this.retryQueue.shift();
    }
    const name = indexToUsername(this.currentIndex);
    this.currentIndex++;
    if (this.currentIndex % 5n === 0n) {
      this.save();
    }
    return name;
  }

  requeueFailed(name) {
    if (name && !this.retryQueue.includes(name)) {
      this.retryQueue.unshift(name);
    }
  }

  markSuccess() {
    this.save();
  }

  getCurrentUsername() {
    if (this.retryQueue.length > 0) return this.retryQueue[0];
    return indexToUsername(this.currentIndex);
  }

  advanceOnSuccess() {
    return this.acquireNext();
  }

  next() {
    return this.acquireNext();
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
    this.inUse = false;
    this.successCount = 0;
    this.rateLimitedCount = 0;
  }

  get isReady() {
    return !this.isDead && !this.inUse && Date.now() >= this.cooldownUntil;
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

  async syncWithDb() {
    try {
      const dbProxies = await getWorkingProxiesFromDb();
      if (Array.isArray(dbProxies) && dbProxies.length > 0) {
        let added = 0;
        for (const p of dbProxies) {
          if (this.addProxy(p)) added++;
        }
        if (added > 0) {
          console.log(`[ProxyPool] Restored ${added} working proxies from PostgreSQL database!`);
        }
      }
    } catch (err) {
      console.warn('[ProxyPool] DB sync warning:', err.message);
    }
  }

  saveToDisk() {
    try {
      const active = this.proxies.filter(p => !p.isDead).map(p => p.url);
      fs.writeFileSync(PROXIES_FILE, active.join('\n') + '\n', 'utf-8');
      saveWorkingProxiesToDb(active).catch(() => {});
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
        candidate.inUse = true;
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
        try { if (req) req.destroy(); } catch {}
        finish(false);
      }, 3000);

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
    this.concurrency = parseInt(process.env.PROXY_PING_CONCURRENCY || '10', 10);
    this.intervalMs = parseInt(process.env.PROXY_PING_INTERVAL_MS || '1500', 10);
    this.running = false;
    this.workerPromises = [];

    this.stats = {
      concurrency: this.concurrency,
      totalRequests: 0,
      successfulRequests: 0,
      cumulativeSuccessfulRequests: 0,
      cumulativeTotalRequests: 0,
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

  async runWorker(workerId) {
    // Stagger worker boot slightly so they don't all contend at the exact same millisecond
    await new Promise(r => setTimeout(r, (workerId - 1) * 200));

    while (this.running) {
      let proxy = null;
      let username = null;

      try {
        // Auto-replenish pool if ready proxies < 20
        if (this.pool.readyCount < 20 && !this.pool.isScraping) {
          this.pool.scrapeAndValidateBatch(250, msg => {
            this.stats.statusMessage = msg;
          }).catch(() => {});
        }

        proxy = this.pool.getReadyProxy();

        if (!proxy) {
          const earliest = this.pool.getFirstCooldownProxy();
          const sleepMs = earliest && earliest.remainingCooldownSec <= 1
            ? Math.max(100, Math.floor(earliest.remainingCooldownSec * 1000))
            : 250;
          await new Promise(r => setTimeout(r, sleepMs));
          continue;
        }

        // Acquire next sequential username (or retry queue item)
        username = usernameLedger.acquireNext();
        this.stats.lastTarget = username;
        this.stats.lastProxyMasked = proxy.masked;

        const res = await this.sendPingRequest(proxy, username);
        this.stats.totalRequests++;
        this.stats.lastPingTime = new Date().toISOString();
        this.stats.lastStatusCode = res.statusCode || res.error;
        this.stats.lastLatencyMs = res.latency;

        if (res.statusCode === 200) {
          this.stats.successfulRequests++;
          this.stats.cumulativeSuccessfulRequests++;
          proxy.successCount++;
          proxy.consecutiveFailures = 0;
          this.stats.statusMessage = `[W${workerId}] OK (200) -> "${username}" via ${proxy.masked} (${res.latency}ms)`;
          console.log(`[ProxyPinger W${workerId}] OK (200) -> "${username}" via ${proxy.masked} (${res.latency}ms) | Session: ${this.stats.successfulRequests}, Cumulative DB: ${this.stats.cumulativeSuccessfulRequests}`);
          usernameLedger.markSuccess();

          // Persist cumulative counts to DB every 5 successful pings
          if (this.stats.successfulRequests % 5 === 0) {
            setDbValue('cumulative_successful_pings', this.stats.cumulativeSuccessfulRequests.toString()).catch(() => {});
            setDbValue('cumulative_total_requests', (this.stats.cumulativeTotalRequests + this.stats.totalRequests).toString()).catch(() => {});
          }

          // Wait polite per-worker pause
          await new Promise(r => setTimeout(r, this.intervalMs));
        } else if (res.statusCode === 429) {
          this.stats.rateLimitedRequests++;
          proxy.rateLimitedCount++;
          proxy.cooldownUntil = Date.now() + DEFAULT_COOLDOWN_MS;
          this.stats.statusMessage = `[W${workerId}] 429 on ${proxy.masked} -> Cooldown 300s (Requeuing "${username}")`;
          console.log(`[ProxyPinger W${workerId}] 429 RateLimit on ${proxy.masked}. Requeuing "${username}"`);
          usernameLedger.requeueFailed(username);
        } else {
          // Dead / failing proxy: cull it immediately so it doesn't cause more failed pings
          this.stats.otherErrors++;
          proxy.isDead = true;
          this.stats.statusMessage = `[W${workerId}] Culled dead proxy ${proxy.masked} (${res.error || res.statusCode}). Requeuing "${username}"...`;
          usernameLedger.requeueFailed(username);
          await new Promise(r => setTimeout(r, 50));
        }
      } catch (err) {
        if (username) usernameLedger.requeueFailed(username);
        await new Promise(r => setTimeout(r, 500));
      } finally {
        if (proxy) {
          proxy.inUse = false; // Always release proxy lock
        }
      }
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.stats.startedAt = new Date().toISOString();

    // 1. Sync state with PostgreSQL so redeploys NEVER reset progress
    try {
      await usernameLedger.syncWithDb();
      await this.pool.syncWithDb();

      const dbSuccess = await getDbValue('cumulative_successful_pings');
      if (dbSuccess) {
        this.stats.cumulativeSuccessfulRequests = parseInt(dbSuccess, 10);
      }
      const dbTotal = await getDbValue('cumulative_total_requests');
      if (dbTotal) {
        this.stats.cumulativeTotalRequests = parseInt(dbTotal, 10);
      }
      console.log(`[ProxyPinger] PostgreSQL state loaded: Cumulative Success = ${this.stats.cumulativeSuccessfulRequests}, Ledger Index = ${usernameLedger.currentIndex}`);
    } catch (err) {
      console.warn('[ProxyPinger] DB init warning:', err.message);
    }

    console.log(`[ProxyPinger] Starting 24/7 background proxy pinging with ${this.concurrency} parallel workers...`);

    // 2. Startup harvest if pool has fewer than 15 proxies
    if (this.pool.readyCount < 15) {
      console.log('[ProxyPinger] Startup: Harvesting initial proxy pool for parallel workers...');
      this.pool.scrapeAndValidateBatch(250, msg => {
        this.stats.statusMessage = msg;
      }).catch(() => {});
    }

    this.workerPromises = [];
    for (let i = 1; i <= this.concurrency; i++) {
      this.workerPromises.push(this.runWorker(i));
    }
  }

  stop() {
    this.running = false;
    console.log('[ProxyPinger] Stopping all workers...');
  }

  getStatus() {
    return {
      service: 'FastClient 24/7 Proxy Pinger',
      running: this.running,
      concurrency: this.concurrency,
      persistence: 'PostgreSQL (cattags-db on Render)',
      ledger: {
        alphabet: 'Base-37 (case-insensitive: a-z, 0-9, _)',
        currentIndex: usernameLedger.currentIndex.toString(),
        nextUsername: usernameLedger.getCurrentUsername(),
        retryQueueLength: usernameLedger.retryQueue.length
      },
      stats: {
        ...this.stats,
        totalCompletedPings: this.stats.cumulativeSuccessfulRequests
      },
      pool: {
        total: this.pool.totalCount,
        ready: this.pool.readyCount,
        inCooldown: this.pool.inCooldownCount
      }
    };
  }
}

export const proxyPingerService = new ProxyPingerService();
