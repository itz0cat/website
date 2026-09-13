import mineflayer from 'mineflayer';

class AFKBotService {
  constructor() {
    this.host = process.env.MC_AFK_HOST || 'lab.mcsh.io';
    this.port = parseInt(process.env.MC_AFK_PORT || '25565', 10);
    this.username = process.env.MC_AFK_USERNAME || 'Itz0Cat_AFK';
    this.version = process.env.MC_AFK_VERSION || '1.21.11';
    this.auth = 'offline';

    this.bot = null;
    this.running = false;
    this.status = 'stopped'; // 'stopped' | 'connecting' | 'online' | 'reconnecting'
    this.reconnectTimer = null;
    this.antiAfkTimer = null;
    this.joinedAt = null;
    this.spawnPosition = null;
    this.health = 20;
    this.food = 20;
    this.stats = {
      reconnects: 0,
      kicks: 0,
      deaths: 0,
      antiAfkPulses: 0,
      chatsSent: 0
    };
    this.logs = [];
  }

  log(msg) {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const line = `[${ts}] [AFKBot] ${msg}`;
    console.log(line);
    this.logs.push(line);
    if (this.logs.length > 50) {
      this.logs.shift();
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.log(`Starting 24/7 AFK Bot targeting ${this.host}:${this.port} (MC ${this.version})...`);
    this.connect();
  }

  stop() {
    this.running = false;
    this.status = 'stopped';
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopAntiAfk();
    if (this.bot) {
      try {
        this.bot.removeAllListeners();
        this.bot.quit();
      } catch (err) {
        // ignore
      }
      this.bot = null;
    }
    this.log('AFK Bot service stopped.');
  }

  reconnect() {
    this.stop();
    this.start();
  }

  connect() {
    if (!this.running) return;
    this.status = 'connecting';
    this.log(`Connecting to ${this.host}:${this.port} as "${this.username}"...`);

    try {
      this.bot = mineflayer.createBot({
        host: this.host,
        port: this.port,
        username: this.username,
        version: this.version,
        auth: this.auth,
        viewDistance: 'tiny',
        physicsEnabled: false,
        checkTimeoutInterval: 60000,
        hideErrors: false
      });
    } catch (err) {
      this.log(`Bot instantiation error: ${err.message}`);
      this.scheduleReconnect();
      return;
    }

    this.bot.once('login', () => {
      this.log(`Logged in successfully! Server brand: ${this.bot.game?.serverBrand || 'Paper'}`);
    });

    this.bot.once('spawn', () => {
      this.status = 'online';
      this.joinedAt = new Date();
      const pos = this.bot.entity?.position;
      if (pos) {
        this.spawnPosition = {
          x: parseFloat(pos.x.toFixed(1)),
          y: parseFloat(pos.y.toFixed(1)),
          z: parseFloat(pos.z.toFixed(1))
        };
      }
      this.health = this.bot.health ?? 20;
      this.food = this.bot.food ?? 20;
      this.log(`Spawned in world at (${this.spawnPosition?.x}, ${this.spawnPosition?.y}, ${this.spawnPosition?.z})! Starting 30s anti-AFK pulse.`);
      this.startAntiAfk();
    });

    this.bot.on('health', () => {
      if (this.bot) {
        this.health = this.bot.health;
        this.food = this.bot.food;
      }
    });

    this.bot.on('death', () => {
      this.stats.deaths++;
      this.log('Bot died! Respawning in 1s...');
      setTimeout(() => {
        try {
          if (this.bot) this.bot.respawn();
        } catch (e) {
          this.log(`Respawn error: ${e.message}`);
        }
      }, 1000);
    });

    this.bot.on('chat', (username, message) => {
      if (!this.bot || username === this.bot.username) return;
      if (message.trim().toLowerCase() === '!ping') {
        this.chat(`Pong! AFKBot is active on Render (HP: ${this.health}/20)`);
      }
    });

    this.bot.on('kicked', (reason) => {
      this.stats.kicks++;
      const reasonStr = typeof reason === 'object' ? JSON.stringify(reason) : String(reason);
      this.log(`Kicked from server: ${reasonStr}`);
    });

    this.bot.on('end', (reason) => {
      this.log(`Disconnected (${reason || 'no reason'}).`);
      this.stopAntiAfk();
      this.scheduleReconnect();
    });

    this.bot.on('error', (err) => {
      this.log(`Connection error: ${err.message}`);
    });
  }

  startAntiAfk() {
    this.stopAntiAfk();
    this.antiAfkTimer = setInterval(() => {
      if (!this.bot || !this.bot.entity || this.status !== 'online') return;
      try {
        // Subtle arm swing
        this.bot.swingArm('right');

        // Look around slightly
        const randomYaw = (Math.random() * Math.PI * 2) - Math.PI;
        this.bot.look(randomYaw, 0, true).catch(() => {});

        // Sneak pulse
        this.bot.setControlState('sneak', true);
        setTimeout(() => {
          if (this.bot) this.bot.setControlState('sneak', false);
        }, 300);

        this.stats.antiAfkPulses++;
      } catch (err) {
        this.log(`Anti-AFK pulse error: ${err.message}`);
      }
    }, 30000);
  }

  stopAntiAfk() {
    if (this.antiAfkTimer) {
      clearInterval(this.antiAfkTimer);
      this.antiAfkTimer = null;
    }
  }

  scheduleReconnect() {
    if (!this.running) return;
    this.status = 'reconnecting';
    this.stats.reconnects++;
    if (this.bot) {
      try { this.bot.removeAllListeners(); } catch {}
      this.bot = null;
    }

    this.log('Scheduling reconnection in 5s (Never-Leave protocol)...');
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  chat(message) {
    if (!this.bot || this.status !== 'online') return false;
    try {
      this.bot.chat(message);
      this.stats.chatsSent++;
      this.log(`Sent chat: ${message}`);
      return true;
    } catch (err) {
      this.log(`Failed to send chat: ${err.message}`);
      return false;
    }
  }

  getStatus() {
    const uptimeSec = this.joinedAt && this.status === 'online'
      ? Math.floor((Date.now() - this.joinedAt.getTime()) / 1000)
      : 0;

    return {
      running: this.running,
      status: this.status,
      host: this.host,
      port: this.port,
      username: this.username,
      version: this.version,
      auth: this.auth,
      uptimeSeconds: uptimeSec,
      spawnPosition: this.spawnPosition,
      health: this.health,
      food: this.food,
      stats: this.stats,
      logs: this.logs.slice(-20)
    };
  }
}

export const afkBotService = new AFKBotService();
