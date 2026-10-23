import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read root configuration on the server only; never expose passwords via define/envPrefix.
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const settings = loadEnv(mode, root, '');
  const target = `http://127.0.0.1:${settings.API_PORT || '5280'}`;
  return {
<<<<<<< HEAD
    plugins: [react()],
=======
    plugins: [
      react(),
      {
        name: 'local-development-url',
        configureServer(server) {
          server.httpServer?.once('listening', () => {
            console.log(`  ➜  Local:   http://localhost:${server.config.server.port}/`);
          });
        },
      },
    ],
>>>>>>> AnhBao
    server: {
      port: Number(settings.WEB_PORT || '5180'),
      strictPort: true,
      proxy: { '/api': target, '/health': target, '/openapi': target },
    },
  };
});
