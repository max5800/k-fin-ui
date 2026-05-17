import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000';
const distDir = path.resolve(__dirname, 'dist');

const app = express();

app.use(
  '/api',
  createProxyMiddleware({
    target: apiTarget,
    changeOrigin: true,
  }),
);

// Lightweight liveness/readiness probe. Registered before the SPA
// catch-all so it returns JSON instead of index.html.
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(express.static(distDir, { index: false }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`k-fin-ui serving on :${port}, /api -> ${apiTarget}`);
});

// Graceful shutdown so K8s rolling updates drain in-flight requests
// instead of waiting out the termination grace period.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, closing server`);
    server.close(() => process.exit(0));
  });
}
