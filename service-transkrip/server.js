const express = require('express');
const config = require('../shared/config');

const app = express();

app.get('/health', (req, res) => {
  res.json({ service: 'service-transkrip', status: 'ok', port: config.ports.transkrip });
});

// SEMENTARA (diganti di Tahap 8): membalas apa yang diterima, hanya untuk menguji gateway.
app.use((req, res) => {
  res.json({
    service: 'service-transkrip',
    sementara: true,
    metode: req.method,
    url: req.originalUrl,
    gatewaySecretCocok: req.get('X-Gateway-Secret') === config.gatewaySecret,
    adaAuthorization: Boolean(req.get('Authorization')),
  });
});

app.listen(config.ports.transkrip, () => {
  console.log(`[SERVICE TRANSKRIP] berjalan di port ${config.ports.transkrip}`);
});