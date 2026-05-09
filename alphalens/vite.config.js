import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/finmind': {
        target: 'https://api.finmindtrade.com/api/v4/data',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/finmind/, '')
      },
      '/twse': {
        target: 'https://www.twse.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/twse/, '/exchangeReport/STOCK_DAY')
      }
    }
  }
});
