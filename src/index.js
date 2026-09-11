import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { healthRouter } from './routes/health.js';
import { fastClientRouter } from './routes/fastclient.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { toolsRouter } from './routes/tools.js';
import { fastClientService } from './modules/fastclient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '../public');

const app = express();
const PORT = parseInt(process.env.PORT || '10000', 10);
const HOST = '0.0.0.0';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

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
      authLogin: 'GET /api/auth/login',
      authMe: 'GET /api/auth/me',
      authLogout: 'POST /api/auth/logout',
      fastclientStatus: 'GET /api/fastclient',
      fastclientLookup: 'GET /api/fastclient/lookup/:username',
      fastclientSearch: 'GET /api/fastclient/search?q=...',
      fastclientPing: 'POST /api/fastclient/ping',
      adminStatus: 'GET /api/admin/status (Discord @itz0cat only)',
      adminConfig: 'POST /api/admin/fastclient/config (Discord @itz0cat only)'
    },
    fastclient: fastClientService.getStatus()
  });
});

// Root route handler
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  res.redirect('/api');
});

// Mount modular routes
app.use('/health', healthRouter);
app.use('/api/fastclient', fastClientRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/tools', toolsRouter);

// Catch-all SPA fallback for client-side routing (Navigo)
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  res.status(404).json({ error: 'Endpoint not found' });
});

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
