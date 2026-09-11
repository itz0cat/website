import { Router } from 'express';
import { fastClientService } from '../modules/fastclient.js';

export const fastClientRouter = Router();

// GET /api/fastclient - Get current status & ping telemetry
fastClientRouter.get('/', (req, res) => {
  res.json(fastClientService.getStatus());
});

// POST /api/fastclient/ping - Trigger manual ping immediately
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

// GET /api/fastclient/check - Check if username is present in active-users.txt
fastClientRouter.get('/check', async (req, res) => {
  const username = req.query.username || null;
  const result = await fastClientService.checkActiveUsers(username);
  res.json(result);
});
