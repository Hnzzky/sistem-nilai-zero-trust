const express = require('express');
const config = require('../shared/config');

const app = express();
app.use(express.json());

// SEMENTARA: akan diproteksi gateway secret di Tahap 9.
app.get('/health', (req, res) => {
  res.json({ service: 'service-nilai', status: 'ok', port: config.ports.nilai });
});

app.listen(config.ports.nilai, () => {
  console.log(`[SERVICE NILAI] berjalan di port ${config.ports.nilai}`);
});