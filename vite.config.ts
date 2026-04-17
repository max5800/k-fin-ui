import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000';
  const hmrClientPort = env.VITE_HMR_CLIENT_PORT
    ? Number(env.VITE_HMR_CLIENT_PORT)
    : undefined;
  // Vite v6 blocks unknown Host headers. When served through an Ingress the
  // host isn't localhost, so we have to allow it explicitly. Comma-separated
  // list; defaults cover local dev.
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean)
    : ['localhost', '127.0.0.1'];

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
      hmr:
        process.env.DISABLE_HMR === 'true'
          ? false
          : hmrClientPort
            ? { clientPort: hmrClientPort }
            : true,
    },
  };
});
