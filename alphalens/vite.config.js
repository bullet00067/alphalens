import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/finmind': {
        target: 'https://api.finmindtrade.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/finmind/, '')
      },
      '/twse': {
        target: 'https://www.twse.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/twse/, '')
      }
    }
  }
});
