const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('../shared/config');

function buatProxy(target, namaService) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: 10000,
    timeout: 10000,
    on: {
      // Header ini ditambahkan gateway; nilai kiriman client akan tertimpa
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('X-Gateway-Secret', config.gatewaySecret);
      },
      error: (err, req, res) => {
        console.error(`[GATEWAY] gagal menghubungi ${namaService}: ${err.message}`);
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `${namaService} tidak dapat dihubungi` }));
        }
      },
    },
  });
}

const proxyNilai = buatProxy(config.urls.nilai, 'Service Nilai');
const proxyTranskrip = buatProxy(config.urls.transkrip, 'Service Transkrip');

// Memilih service tujuan berdasarkan awal path
function teruskan(req, res, next) {
  if (req.path.startsWith('/nilai') || req.path.startsWith('/kelas')) {
    return proxyNilai(req, res, next);
  }
  if (req.path.startsWith('/transkrip')) {
    return proxyTranskrip(req, res, next);
  }
  return res.status(404).json({ error: 'Endpoint tidak ditemukan' });
}

module.exports = { teruskan };