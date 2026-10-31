const express = require('express');
const config = require('../shared/config');
const { wajibGatewaySecret } = require('../shared/gatewaySecret');
const { wajibToken } = require('../shared/authMiddleware');
const nilaiRoutes = require('./routes/nilai');
const kelasRoutes = require('./routes/kelas');

const app = express();

// Lapisan 1: tanpa X-Gateway-Secret yang benar, TIDAK ADA rute yang menjawab
app.use(wajibGatewaySecret('SERVICE NILAI'));

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'service-nilai', status: 'ok', port: config.ports.nilai });
});

// Lapisan 2: JWT harus valid (tanda tangan dan masa berlaku)
app.use('/nilai', wajibToken, nilaiRoutes);
app.use('/kelas', wajibToken, kelasRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Body JSON tidak valid' });
  }
  console.error('[SERVICE NILAI] error:', err);
  res.status(500).json({ error: 'Kesalahan internal service nilai' });
});

app.listen(config.ports.nilai, () => {
  console.log(`[SERVICE NILAI] berjalan di port ${config.ports.nilai}`);
});
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Body JSON tidak valid' });
  }
  console.error('[SERVICE NILAI] error:', err);
  res.status(500).json({ error: 'Kesalahan internal service nilai' });
});

app.listen(config.ports.nilai, () => {
  console.log(`[SERVICE NILAI] berjalan di port ${config.ports.nilai}`);
});