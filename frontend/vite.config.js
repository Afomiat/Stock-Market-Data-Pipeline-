import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load environment variables from the current working directory
  const env = loadEnv(mode, process.cwd(), '');
  
  // Use VITE_API_URL or fall back to the local Go backend URL
  const backendUrl = env.VITE_API_URL || 'http://localhost:8080';
  
  // Derive WebSocket target, ensuring ws:// or wss:// protocol
  let wsUrl = env.VITE_WS_URL;
  if (!wsUrl) {
    wsUrl = backendUrl.replace(/^http/, 'ws');
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/yahoo-finance': {
          target: 'https://query1.finance.yahoo.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/yahoo-finance/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
            });
          },
        },
        '/ws': {
          target: wsUrl,
          ws: true,
          changeOrigin: true,
          secure: true,
          configure: (proxy, _options) => {
            proxy.on('proxyReqWs', (proxyReq, req, _socket, _options, _head) => {
              try {
                const url = new URL(req.url, 'http://localhost');
                const token = url.searchParams.get('token');
                if (token) {
                  proxyReq.setHeader('Authorization', `Bearer ${token}`);
                }
              } catch (err) {
                console.error('Error setting Authorization header for proxy WebSocket:', err);
              }
            });
          },
        },
      },
    },
  };
});
