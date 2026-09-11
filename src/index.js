import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.js';
import { fastClientRouter } from './routes/fastclient.js';
import { fastClientService } from './modules/fastclient.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

// Root overview
app.get('/', (req, res) => {
  res.json({
    service: 'Random',
    description: 'Modular micro-services backend for utility tasks, keepalives, and small bots',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      fastclientStatus: 'GET /api/fastclient',
      fastclientPing: 'POST /api/fastclient/ping',
      fastclientToggle: 'POST /api/fastclient/toggle',
      fastclientCheckUser: 'GET /api/fastclient/check?username=Itz0Cat__'
    },
    fastclient: fastClientService.getStatus()
  });
});

// Mount modular routes
app.use('/health', healthRouter);
app.use('/api/fastclient', fastClientRouter);

const server = app.listen(PORT, HOST, () => {
  console.log(`[Random] Server online at http://${HOST}:${PORT}`);
  console.log(`[Random] Health check available at http://${HOST}:${PORT}/health`);

  // Start background services
  fastClientService.start();
});

const shutdown = (signal) => {
  console.log(`[Random] Received ${signal}, gracefully shutting down...`);
  fastClientService.stop();
  server.close(() => {
    console.log('[Random] Server shut down gracefully.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Random] Forced shutdown.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
