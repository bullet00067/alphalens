const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy for TWSE
app.use('/twse', createProxyMiddleware({
  target: 'https://www.twse.com.tw',
  changeOrigin: true,
  pathRewrite: { '^/twse': '' },
}));

// Proxy for FinMind
app.use('/finmind', createProxyMiddleware({
  target: 'https://api.finmindtrade.com',
  changeOrigin: true,
  pathRewrite: { '^/finmind': '' },
}));

// Serve static files from the build output
app.use(express.static(path.join(__dirname, 'dist')));

// Support for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Production server is running on port ${PORT}`);
});
