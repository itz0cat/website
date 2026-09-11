const PING_ENDPOINT = 'https://api.fastclient.net/api/fastclient/ping';
const ACTIVE_USERS_URL = 'https://files.fastclient.net/fastclient/active-users.txt';

class FastClientService {
  constructor() {
    this.username = process.env.FASTCLIENT_USER || 'Itz0Cat__';
    this.enabled = process.env.FASTCLIENT_AUTO_PING !== 'false';
    // FastClient enforces 5 requests per 300s (5min) rate limit per IP.
    // 120s interval = 2.5 requests per 5min, well under the limit.
    this.intervalMs = parseInt(process.env.FASTCLIENT_INTERVAL_MS || '120000', 10);
    this.timer = null;

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
        console.log(`[FastClient] Ping succeeded for "${user}" (status: ${res.status}, response:`, json, ')');
      } else {
        this.stats.failedPings++;
        this.stats.lastError = `HTTP ${res.status}: ${JSON.stringify(json)}`;
        console.warn(`[FastClient] Ping failed for "${user}" (status: ${res.status})`);
      }

      return { success: res.ok, status: res.status, data: json };
    } catch (err) {
      this.stats.failedPings++;
      this.stats.lastError = err.message;
      console.error(`[FastClient] Network error pinging for "${user}":`, err.message);
      return { success: false, error: err.message };
    }
  }

  async checkActiveUsers(searchUser = null) {
    const target = (searchUser || this.username).toLowerCase();
    try {
      const res = await fetch(ACTIVE_USERS_URL, {
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) {
        return { success: false, error: `Failed to fetch active users: HTTP ${res.status}` };
      }
      const text = await res.text();
      const lines = text.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean);
      const isPresent = lines.includes(target);

      return {
        success: true,
        targetUser: target,
        isPresent,
        totalUsers: lines.length,
        checkedAt: new Date().toISOString()
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  start() {
    if (this.timer) return;
    this.stats.startedAt = new Date().toISOString();
    console.log(`[FastClient] Starting background pinger for "${this.username}" every ${this.intervalMs / 1000}s`);

    // Immediate initial ping
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
