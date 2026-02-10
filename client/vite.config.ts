import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/register': 'http://localhost:3000',
      '/status': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
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
    }
  }
})
