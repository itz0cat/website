import { Router } from 'express';
import { fastClientService } from '../modules/fastclient.js';
import { proxyPingerService } from '../modules/proxyPinger.js';
import { requireAdmin } from '../modules/auth.js';

export const fastClientRouter = Router();

// FastClient tools are developer-only, strictly gated to Discord @itz0cat
fastClientRouter.use(requireAdmin);

// GET /api/fastclient - Status & background telemetry
fastClientRouter.get('/', (req, res) => {
  res.json({
    legacy: fastClientService.getStatus(),
    proxyPinger: proxyPingerService.getStatus()
  });
});

// GET /api/fastclient/proxy-pinger - 24/7 Proxy Pinger Live Telemetry
fastClientRouter.get('/proxy-pinger', (req, res) => {
  res.json(proxyPingerService.getStatus());
});

// POST /api/fastclient/proxy-pinger/toggle - Start/Stop 24/7 Proxy Pinger
fastClientRouter.post('/proxy-pinger/toggle', (req, res) => {
  if (proxyPingerService.running) {
    proxyPingerService.stop();
  } else {
    proxyPingerService.start();
  }
  res.json({
    message: `Proxy Pinger ${proxyPingerService.running ? 'started' : 'stopped'}`,
    status: proxyPingerService.getStatus()
  });
});

// POST /api/fastclient/proxy-pinger/scrape - Trigger immediate 250 candidate proxy harvest
fastClientRouter.post('/proxy-pinger/scrape', async (req, res) => {
  const batchSize = parseInt(req.body?.batchSize || '250', 10);
  proxyPingerService.pool.scrapeAndValidateBatch(batchSize);
  res.json({
    message: `Scrape batch of ${batchSize} triggered in background`,
    status: proxyPingerService.getStatus()
  });
});

// GET /api/fastclient/lookup/:username - Inspect any player, cosmetics & Mojang info
fastClientRouter.get('/lookup/:username', async (req, res) => {
  const result = await fastClientService.lookup(req.params.username);
  res.json(result);
});

// GET /api/fastclient/search?q=... - Search players across active manifest
fastClientRouter.get('/search', async (req, res) => {
  const q = req.query.q || req.query.query || '';
  const result = await fastClientService.search(q);
  res.json(result);
});

// POST /api/fastclient/ping - Trigger immediate registration ping
fastClientRouter.post('/ping', async (req, res) => {
  const { username } = req.body || {};
  const result = await fastClientService.sendPing(username);
  res.status(result.success ? 200 : 502).json({
    message: result.success ? 'Ping dispatched successfully' : 'Ping failed',
    result,
    currentStatus: fastClientService.getStatus()
  });
});

// POST /api/fastclient/toggle - Enable or disable background pinging
fastClientRouter.post('/toggle', (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled === 'boolean') {
    fastClientService.enabled = enabled;
  } else {
    fastClientService.enabled = !fastClientService.enabled;
  }

  res.json({
    message: `FastClient auto-ping ${fastClientService.enabled ? 'enabled' : 'disabled'}`,
    status: fastClientService.getStatus()
  });
});

