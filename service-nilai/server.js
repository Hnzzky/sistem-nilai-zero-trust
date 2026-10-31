const express = require('express');
const config = require('../shared/config');
const { wajibToken } = require('../shared/authMiddleware');
const nilaiRoutes = require('./routes/nilai');
const kelasRoutes = require('./routes/kelas');

const app = express();
app.use(express.json());

// SEMENTARA: akan diproteksi gateway secret di Tahap 9.
app.get('/health', (req, res) => {
  res.json({ service: 'service-nilai', status: 'ok', port: config.ports.nilai });
});

// Semua rute data wajib membawa JWT valid
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