import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    allowedHosts: ['rsudtgrs.my.id'],
    hmr: {
      protocol: 'wss',
      host: 'rsudtgrs.my.id',
      clientPort: 443,
    },
    proxy: {
      '/register': 'http://localhost:3000',
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/positions': 'http://localhost:3000',
      '/admin': {
        target: 'http://localhost:3000',
        bypass: (req) => {
          // Don't proxy browser navigation requests (let React Router handle them)
          if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return req.url;
          }
        }
      },
      '/uploads': 'http://localhost:3000'
      ,
      '/file': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
