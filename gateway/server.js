const express = require('express');
const config = require('../shared/config');

const app = express();
app.use(express.json());

// SEMENTARA: hanya untuk memastikan server hidup. Diganti di Tahap 5.
app.get('/health', (req, res) => {
  res.json({ service: 'api-gateway', status: 'ok', port: config.ports.gateway });
});

app.listen(config.ports.gateway, () => {
  console.log(`[GATEWAY] berjalan di port ${config.ports.gateway}`);
});