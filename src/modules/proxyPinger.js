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

// Minecraft Username Generator Helper
const ADJECTIVES = [
  'Swift', 'Dark', 'Iron', 'Red', 'Blue', 'Gold', 'Epic', 'Cool', 'Wild',
  'Shadow', 'Pixel', 'Frost', 'Cyber', 'Neon', 'Blaze', 'Nova', 'Cosmic',
  'Apex', 'Viper', 'Storm', 'Mystic', 'Hyper', 'Silver', 'Ghost', 'Solar'
];
const NOUNS = [
  'Wolf', 'Knight', 'Fox', 'Panda', 'Dragon', 'Tiger', 'Falcon', 'Bear',
  'Hawk', 'Viper', 'Miner', 'Crafter', 'Hunter', 'Warrior', 'Builder',
  'Player', 'Runner', 'Walker', 'Striker', 'Master', 'Gamer', 'Sniper'
];
const SUFFIXES = ['MC', 'Pro', 'YT', 'HD', 'OG', 'Dev', 'X', '01', '07', '77', '99', '42', 'Bot'];

function generateMinecraftUsername() {
  const style = Math.floor(Math.random() * 4);
  let name = '';
  if (style === 0) {
    name = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;
  } else if (style === 1) {
    name = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}_${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;
  } else if (style === 2) {
    name = `${NOUNS[Math.floor(Math.random() * NOUNS.length)]}${Math.floor(Math.random() * 899 + 100)}`;
  } else {
    name = `${NOUNS[Math.floor(Math.random() * NOUNS.length)]}_${SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]}`;
  }
  name = name.replace(/[^a-zA-Z0-9_]/g, '');
  if (name.length < 3) name += '_99';
  if (name.length > 16) name = name.slice(0, 16);
  return name;
}

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
      try {
        const agent = getProxyAgent(proxyUrl);
        const payload = JSON.stringify({ username: 'ProbeCheck' });

        const req = https.request(
          PING_ENDPOINT,
          {
            method: 'POST',
            agent,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': USER_AGENT,
              'Content-Length': Buffer.byteLength(payload)
            },
            timeout: REQUEST_TIMEOUT_MS
          },
          res => {
            res.resume();
            // 200 or 429 confirms proxy can talk to API
            resolve(res.statusCode === 200 || res.statusCode === 429);
          }
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.write(payload);
        req.end();
      } catch {
        resolve(false);
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

      try {
        const agent = getProxyAgent(proxyNode.url);
        const req = https.request(
          PING_ENDPOINT,
          {
            method: 'POST',
            agent,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': USER_AGENT,
              'Content-Length': Buffer.byteLength(payload)
            },
            timeout: REQUEST_TIMEOUT_MS
          },
          res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              const latency = Date.now() - startTime;
              resolve({
                success: res.statusCode === 200,
                statusCode: res.statusCode,
                headers: res.headers,
                latency,
                body: data
              });
            });
          }
        );

        req.on('error', err => {
          resolve({
            success: false,
            statusCode: null,
            error: err.message,
            latency: Date.now() - startTime
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            statusCode: null,
            error: 'Timeout',
            latency: Date.now() - startTime
          });
        });

        req.write(payload);
        req.end();
      } catch (err) {
        resolve({
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
            console.log(`[ProxyPinger] All proxies in cooldown (${remSec}s remaining). Scraping fresh batch...`);
            this.stats.statusMessage = `All proxies in cooldown (${remSec}s). Scraping 250 fresh candidates...`;

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

        // Active ready proxy found
        const username = generateMinecraftUsername();
        this.stats.lastTarget = username;
        this.stats.lastProxyMasked = proxy.masked;
        this.stats.statusMessage = `Pinging via ${proxy.masked}...`;

        const res = await this.sendPingRequest(proxy, username);
        this.stats.totalRequests++;
        this.stats.lastPingTime = new Date().toISOString();
        this.stats.lastStatusCode = res.statusCode || res.error;
        this.stats.lastLatencyMs = res.latency;

        if (res.statusCode === 200) {
          this.stats.successfulRequests++;
          proxy.successCount++;
          proxy.consecutiveFailures = 0;
          this.stats.statusMessage = `OK (200) via ${proxy.masked} (${res.latency}ms)`;
          await new Promise(r => setTimeout(r, this.intervalMs));
        } else if (res.statusCode === 429) {
          this.stats.rateLimitedRequests++;
          proxy.rateLimitedCount++;
          proxy.cooldownUntil = Date.now() + DEFAULT_COOLDOWN_MS;
          this.stats.statusMessage = `429 Rate Limit on ${proxy.masked} -> Cooldown 300s`;
          // Rotate immediately to next proxy without pause
        } else {
          this.stats.otherErrors++;
          proxy.consecutiveFailures++;
          if (proxy.consecutiveFailures >= 4) {
            proxy.isDead = true;
          }
          this.stats.statusMessage = `Error (${res.error || res.statusCode}) on ${proxy.masked}`;
          await new Promise(r => setTimeout(r, 500));
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
