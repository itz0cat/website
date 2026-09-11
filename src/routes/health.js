import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  res.json({
    status: 'ok',
    service: 'random-backend',
    version: '1.0.0',
    uptimeSeconds,
    uptimeHuman: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
    timestamp: new Date().toISOString()
  });
});
