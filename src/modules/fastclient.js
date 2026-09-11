const PING_ENDPOINT = 'https://api.fastclient.net/api/fastclient/ping';
const ACTIVE_USERS_URL = 'https://files.fastclient.net/fastclient/active-users.txt';
const CDN_ROOT = 'https://files.fastclient.net/textures';
const MOJANG_API = 'https://api.mojang.com/users/profiles/minecraft';

class FastClientService {
  constructor() {
    this.username = process.env.FASTCLIENT_USER || 'Itz0Cat__';
    this.enabled = process.env.FASTCLIENT_AUTO_PING !== 'false';
    this.intervalMs = parseInt(process.env.FASTCLIENT_INTERVAL_MS || '120000', 10);
    this.timer = null;

    // In-memory cached active users manifest with 60s TTL
    this.cachedManifest = null;
    this.manifestExpiresAt = 0;

    this.stats = {
      totalPings: 0,
      successPings: 0,
      failedPings: 0,
      lastPingTime: null,
      lastStatusCode: null,
      lastResponse: null,
      lastError: null,
      startedAt: null
    };
  }

  async getManifest() {
    const now = Date.now();
    if (this.cachedManifest && now < this.manifestExpiresAt) {
      return this.cachedManifest;
    }

    try {
      const res = await fetch(ACTIVE_USERS_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FastClient/1.21.11' },
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const users = text.split('\n').map(l => l.trim()).filter(Boolean);
      this.cachedManifest = users;
      this.manifestExpiresAt = now + 60000; // Cache for 60 seconds
      return users;
    } catch (err) {
      if (this.cachedManifest) return this.cachedManifest;
      return [];
    }
  }

  async checkAsset(url) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FastClient/1.21.11' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const len = res.headers.get('content-length');
        return { exists: true, size: len ? parseInt(len, 10) : null, url };
      }
    } catch {}
    return { exists: false, url };
  }

  async getMojangProfile(username) {
    try {
      const res = await fetch(`${MOJANG_API}/${encodeURIComponent(username)}`, {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return null;
  }

  async lookup(targetUser) {
    const userClean = (targetUser || '').trim();
    if (!userClean) return { error: 'Username required' };

    const [users, mojang, cape, skin, slimSkin] = await Promise.all([
      this.getManifest(),
      this.getMojangProfile(userClean),
      this.checkAsset(`${CDN_ROOT}/capes/${userClean}.png`),
      this.checkAsset(`${CDN_ROOT}/skins/${userClean}.png`),
      this.checkAsset(`${CDN_ROOT}/skins/${userClean}-slim.png`)
    ]);

    const targetLower = userClean.toLowerCase();
    const index = users.findIndex(u => u.toLowerCase() === targetLower);
    const isActive = index !== -1;
    const exactName = isActive ? users[index] : (mojang ? mojang.name : userClean);

    return {
      username: exactName,
      active: isActive,
      rank: isActive ? index + 1 : null,
      totalUsers: users.length,
      mojang: mojang ? { id: mojang.id, name: mojang.name, verified: true } : { verified: false },
      avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(exactName)}/128`,
      headUrl: `https://mc-heads.net/head/${encodeURIComponent(exactName)}/64`,
      cosmetics: {
        cape: cape.exists ? { exists: true, url: cape.url, size: cape.size } : { exists: false },
        skin: skin.exists ? { exists: true, url: skin.url, size: skin.size } : { exists: false },
        slimSkin: slimSkin.exists ? { exists: true, url: slimSkin.url, size: slimSkin.size } : { exists: false }
      },
      badges: {
        tabOverlay: isActive,
        nametagBadge: isActive
      },
      checkedAt: new Date().toISOString()
    };
  }

  async search(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return { matches: [], total: 0 };

    const users = await this.getManifest();
    const matches = users.filter(u => u.toLowerCase().includes(q));
    return {
      query: q,
      totalMatches: matches.length,
      matches: matches.slice(0, 50),
      totalUsers: users.length
    };
  }

  async sendPing(targetUser = null) {
    const user = targetUser || this.username;
    this.stats.totalPings++;
    this.stats.lastPingTime = new Date().toISOString();

    try {
      const res = await fetch(PING_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FastClient/1.21.11'
        },
        body: JSON.stringify({ username: user }),
        signal: AbortSignal.timeout(10000)
      });

      this.stats.lastStatusCode = res.status;
      const json = await res.json().catch(() => ({}));
      this.stats.lastResponse = json;

      if (res.ok) {
        this.stats.successPings++;
        this.stats.lastError = null;
        console.log(`[FastClient] Ping succeeded for "${user}" (status: ${res.status})`);
      } else {
        this.stats.failedPings++;
        this.stats.lastError = `HTTP ${res.status}: ${JSON.stringify(json)}`;
        console.warn(`[FastClient] Ping failed for "${user}" (status: ${res.status})`);
      }

      return { success: res.ok, status: res.status, data: json };
    } catch (err) {
      this.stats.failedPings++;
      this.stats.lastError = err.message;
      return { success: false, error: err.message };
    }
  }

  start() {
    if (this.timer) return;
    this.stats.startedAt = new Date().toISOString();
    console.log(`[FastClient] Starting background pinger for "${this.username}" every ${this.intervalMs / 1000}s`);

    if (this.enabled) {
      this.sendPing();
    }

    this.timer = setInterval(() => {
      if (this.enabled) {
        this.sendPing();
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[FastClient] Background pinger stopped.');
    }
  }

  getStatus() {
    return {
      service: 'FastClient Pinger',
      targetUsername: this.username,
      enabled: this.enabled,
      intervalSeconds: this.intervalMs / 1000,
      active: !!this.timer,
      stats: this.stats
    };
  }
}

export const fastClientService = new FastClientService();
