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

app.use(express.static(distDir, { index: false }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`k-fin-ui serving on :${port}, /api -> ${apiTarget}`);
});
