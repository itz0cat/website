import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { healthRouter } from './routes/health.js';
import { fastClientRouter } from './routes/fastclient.js';
import { fastClientService } from './modules/fastclient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '../public');

const app = express();
const PORT = parseInt(process.env.PORT || '10000', 10);
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

// Serve static portfolio frontend
app.use(express.static(PUBLIC_DIR));

// JSON API directory endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'itz0cat-website-and-backend',
    description: 'Portfolio website + background utility microservices hub',
    version: '1.0.0',
    endpoints: {
      portfolio: 'GET /',
      health: 'GET /health',
      fastclientStatus: 'GET /api/fastclient',
      fastclientPing: 'POST /api/fastclient/ping',
      fastclientToggle: 'POST /api/fastclient/toggle',
      fastclientCheckUser: 'GET /api/fastclient/check?username=Itz0Cat__'
    },
    fastclient: fastClientService.getStatus()
  });
});

// If browser asks for root, static index.html is served automatically.
// If client specifically asks for application/json at root, serve JSON.
app.get('/', (req, res, next) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  res.redirect('/api');
});

// Mount modular routes
app.use('/health', healthRouter);
app.use('/api/fastclient', fastClientRouter);

const server = app.listen(PORT, HOST, () => {
  console.log(`[itz0cat] Portfolio & Backend online at http://${HOST}:${PORT}`);
  console.log(`[itz0cat] Health check available at http://${HOST}:${PORT}/health`);

  // Start background services
  fastClientService.start();
});

const shutdown = (signal) => {
  console.log(`[itz0cat] Received ${signal}, gracefully shutting down...`);
  fastClientService.stop();
  server.close(() => {
    console.log('[itz0cat] Server shut down gracefully.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[itz0cat] Forced shutdown.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
