const express = require('express');
const config = require('../shared/config');
const { wajibToken } = require('../shared/authMiddleware');
const transkripRoutes = require('./routes/transkrip');

const app = express();
app.use(express.json());

// SEMENTARA: akan diproteksi gateway secret di Tahap 9.
app.get('/health', (req, res) => {
  res.json({ service: 'service-transkrip', status: 'ok', port: config.ports.transkrip });
});

// Semua rute data wajib membawa JWT valid
app.use('/transkrip', wajibToken, transkripRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Body JSON tidak valid' });
  }
  console.error('[SERVICE TRANSKRIP] error:', err);
  res.status(500).json({ error: 'Kesalahan internal service transkrip' });
});

app.listen(config.ports.transkrip, () => {
  console.log(`[SERVICE TRANSKRIP] berjalan di port ${config.ports.transkrip}`);
});