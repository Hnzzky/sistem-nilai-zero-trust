const express = require('express');
const config = require('../shared/config');

const app = express();
app.use(express.json());

// SEMENTARA: akan diproteksi gateway secret di Tahap 9.
app.get('/health', (req, res) => {
  res.json({ service: 'service-transkrip', status: 'ok', port: config.ports.transkrip });
});

app.listen(config.ports.transkrip, () => {
  console.log(`[SERVICE TRANSKRIP] berjalan di port ${config.ports.transkrip}`);
});