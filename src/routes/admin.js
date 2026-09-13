import { Router } from 'express';
import { requireAdmin } from '../modules/auth.js';
import { fastClientService } from '../modules/fastclient.js';
import { proxyPingerService } from '../modules/proxyPinger.js';
import { afkBotService } from '../modules/afkbot.js';

export const adminRouter = Router();

// Apply requireAdmin to all routes in this router
adminRouter.use(requireAdmin);

// GET /api/admin/status - Full dev telemetry & system stats
adminRouter.get('/status', (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    admin: req.user.username,
    fastclient: fastClientService.getStatus(),
    proxyPinger: proxyPingerService.getStatus(),
    afkBot: afkBotService.getStatus(),
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rssMb: (memory.rss / (1024 * 1024)).toFixed(2),
        heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(2),
        heapTotalMb: (memory.heapTotal / (1024 * 1024)).toFixed(2)
      },
      env: {
        nodeEnv: process.env.NODE_ENV || 'production',
        port: process.env.PORT || '10000',
        fastClientUser: fastClientService.username
      }
    }
  });
});

// POST /api/admin/fastclient/config - Update target user or interval
adminRouter.post('/fastclient/config', (req, res) => {
  const { username, intervalSeconds } = req.body || {};

  if (username && typeof username === 'string') {
    fastClientService.username = username.trim();
  }

  if (intervalSeconds && !isNaN(intervalSeconds)) {
    const sec = Math.max(30, parseInt(intervalSeconds, 10));
    fastClientService.intervalMs = sec * 1000;
    // Restart timer with new interval if active
    if (fastClientService.timer) {
      fastClientService.stop();
      fastClientService.start();
    }
  }

  res.json({
    message: 'FastClient pinger configuration updated',
    status: fastClientService.getStatus()
  });
});

// POST /api/admin/fastclient/toggle - Enable or disable background pinging
adminRouter.post('/fastclient/toggle', (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled === 'boolean') {
    fastClientService.enabled = enabled;
  } else {
    fastClientService.enabled = !fastClientService.enabled;
  }

  if (!fastClientService.enabled && fastClientService.timer) {
    fastClientService.stop();
  } else if (fastClientService.enabled && !fastClientService.timer) {
    fastClientService.start();
  }

  res.json({
    message: `FastClient pinger ${fastClientService.enabled ? 'activated' : 'paused'}`,
    status: fastClientService.getStatus()
  });
});

// POST /api/admin/fastclient/ping - Trigger immediate manual ping
adminRouter.post('/fastclient/ping', async (req, res) => {
  const { username } = req.body || {};
  const result = await fastClientService.sendPing(username || fastClientService.username);
  res.json({
    message: result.success ? 'Ping succeeded' : 'Ping failed',
    result,
    status: fastClientService.getStatus()
  });
});

// POST /api/admin/proxy-pinger/toggle - Start/Stop 24/7 Proxy Pinger
adminRouter.post('/proxy-pinger/toggle', (req, res) => {
  if (proxyPingerService.running) {
    proxyPingerService.stop();
  } else {
    proxyPingerService.start();
  }
  res.json({
    message: `24/7 Proxy Pinger ${proxyPingerService.running ? 'started' : 'stopped'}`,
    status: proxyPingerService.getStatus()
  });
});

// POST /api/admin/proxy-pinger/scrape - Trigger immediate candidate proxy harvest
adminRouter.post('/proxy-pinger/scrape', (req, res) => {
  const batchSize = parseInt(req.body?.batchSize || '250', 10);
  proxyPingerService.pool.scrapeAndValidateBatch(batchSize);
  res.json({
    message: `Batch proxy scrape (${batchSize}) started in background`,
    status: proxyPingerService.getStatus()
  });
});

// POST /api/admin/afkbot/toggle - Start/Stop 24/7 Minecraft AFK Bot
adminRouter.post('/afkbot/toggle', (req, res) => {
  if (afkBotService.running) {
    afkBotService.stop();
  } else {
    afkBotService.start();
  }
  res.json({
    message: `AFK Bot ${afkBotService.running ? 'started' : 'stopped'}`,
    status: afkBotService.getStatus()
  });
});

// POST /api/admin/afkbot/reconnect - Force reconnect
adminRouter.post('/afkbot/reconnect', (req, res) => {
  afkBotService.reconnect();
  res.json({
    message: 'AFK Bot reconnect sequence triggered',
    status: afkBotService.getStatus()
  });
});

// POST /api/admin/afkbot/chat - Send in-game chat packet
adminRouter.post('/afkbot/chat', (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message text is required' });
  }
  const sent = afkBotService.chat(message.trim());
  res.json({
    success: sent,
    message: sent ? 'Chat packet sent' : 'Bot is offline or not spawned',
    status: afkBotService.getStatus()
  });
});


