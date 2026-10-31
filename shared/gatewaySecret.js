const crypto = require('crypto');
const config = require('./config');

// Hash dulu supaya kedua nilai berpanjang sama (syarat timingSafeEqual)
const hash = (teks) => crypto.createHash('sha256').update(teks).digest();
const hashDiharapkan = hash(config.gatewaySecret);

// Menolak semua request yang tidak membawa X-Gateway-Secret yang benar.
// Dipasang PALING AWAL di setiap service.
function wajibGatewaySecret(namaService) {
  return (req, res, next) => {
    const diberikan = req.get('X-Gateway-Secret');

    if (!diberikan) {
      console.warn(`[${namaService}] DITOLAK ${req.method} ${req.originalUrl}: X-Gateway-Secret tidak ada`);
      return res.status(403).json({ error: 'Akses langsung ditolak: request harus melalui API Gateway' });
    }

    if (!crypto.timingSafeEqual(hash(diberikan), hashDiharapkan)) {
      console.warn(`[${namaService}] DITOLAK ${req.method} ${req.originalUrl}: X-Gateway-Secret salah`);
      return res.status(403).json({ error: 'Akses langsung ditolak: request harus melalui API Gateway' });
    }

    return next();
  };
}

module.exports = { wajibGatewaySecret };