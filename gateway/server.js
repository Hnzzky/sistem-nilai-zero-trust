const express = require('express');
const config = require('../shared/config');
const authRoutes = require('./routes/auth');
const enforce = require('./middleware/enforce');
const { teruskan } = require('./proxy');

const app = express();

// Endpoint yang ditangani gateway sendiri (PE/PA). Hanya di sini body JSON dibaca.
app.use('/auth', express.json(), authRoutes);

// Pemeriksaan kesehatan gateway saja (tidak mengakses data)
app.get('/health', (req, res) => {
  res.json({ service: 'api-gateway', status: 'ok', port: config.ports.gateway });
});

// Semua request lain: PEP memeriksa, lalu proxy meneruskan
app.use(enforce);
app.use(teruskan);

// Penangkap error, misalnya JSON yang rusak pada /auth
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Body JSON tidak valid' });
  }
  console.error('[GATEWAY] error:', err);
  res.status(500).json({ error: 'Kesalahan internal gateway' });
});

app.listen(config.ports.gateway, () => {
  console.log(`[GATEWAY] berjalan di port ${config.ports.gateway}`);
});