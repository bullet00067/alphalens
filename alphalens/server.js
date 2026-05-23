import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Proxy for TWSE
app.use('/twse', createProxyMiddleware({
    target: 'https://www.twse.com.tw',
    changeOrigin: true,
    pathRewrite: {
        '^/twse': '/exchangeReport/STOCK_DAY',
    },
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    }
}));

// 2. Proxy for FinMind
app.use('/finmind', createProxyMiddleware({
    target: 'https://api.finmindtrade.com/api/v4/data',
    changeOrigin: true,
    pathRewrite: {
        '^/finmind': '',
    },
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    }
}));

// 3. Proxy for Yahoo Finance
app.use('/yahoo', createProxyMiddleware({
    target: 'https://query2.finance.yahoo.com/v8/finance/chart',
    changeOrigin: true,
    pathRewrite: {
        '^/yahoo': '',
    },
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    }
}));

// 4. Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// 5. Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
