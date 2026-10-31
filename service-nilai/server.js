const express = require('express');
const config = require('../shared/config');

const app = express();

app.get('/health', (req, res) => {
  res.json({ service: 'service-nilai', status: 'ok', port: config.ports.nilai });
});

// SEMENTARA (diganti di Tahap 7): membalas apa yang diterima, hanya untuk menguji gateway.
// Rahasia tidak pernah ditampilkan, hanya apakah cocok atau tidak.
app.use((req, res) => {
  res.json({
    service: 'service-nilai',
    sementara: true,
    metode: req.method,
    url: req.originalUrl,
    gatewaySecretCocok: req.get('X-Gateway-Secret') === config.gatewaySecret,
    adaAuthorization: Boolean(req.get('Authorization')),
  });
});

app.listen(config.ports.nilai, () => {
  console.log(`[SERVICE NILAI] berjalan di port ${config.ports.nilai}`);
});