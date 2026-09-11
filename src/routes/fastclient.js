import { Router } from 'express';
import { fastClientService } from '../modules/fastclient.js';

export const fastClientRouter = Router();

// GET /api/fastclient - Status & background telemetry
fastClientRouter.get('/', (req, res) => {
  res.json(fastClientService.getStatus());
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
