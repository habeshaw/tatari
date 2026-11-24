import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTatariApp, runFullBackgroundSync } from './src/serverApp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const BACKGROUND_SYNC_INTERVAL_MS = 30 * 60 * 1000;

async function startServer() {
  const app = createTatariApp();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TATARI server running on http://0.0.0.0:${PORT}`);
    setTimeout(() => {
      runFullBackgroundSync(false).catch((err) => {
        console.error('Initial background sync error:', err);
      });
    }, 1000);
    setInterval(() => {
      runFullBackgroundSync(true).catch((err) => {
        console.error('Periodic background sync error:', err);
      });
    }, BACKGROUND_SYNC_INTERVAL_MS);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TATARI server:', err);
  process.exit(1);
});
