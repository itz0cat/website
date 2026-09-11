import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    service: 'random-backend',
    version: '1.0.0',
    uptimeSeconds,
    uptimeHuman: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
    memory: {
      rssMb: parseFloat((mem.rss / 1024 / 1024).toFixed(1)),
      heapUsedMb: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(1)),
      heapTotalMb: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(1)),
      percentOf512Mb: `${((mem.rss / (512 * 1024 * 1024)) * 100).toFixed(1)}%`
    },
    timestamp: new Date().toISOString()
  });
});
