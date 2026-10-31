const db = require('../database/db');
const config = require('../shared/config');

const simpan = db.prepare(`
  INSERT INTO audit_log (waktu, subjek, role, metode, endpoint, device_id, keputusan, alasan)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Waktu dalam zona waktu dari .env, format: 2026-10-31 14:05:09
function waktuSekarang() {
  return new Date().toLocaleString('sv-SE', { timeZone: config.accessHours.timezone });
}

// Mencatat satu keputusan akses (ALLOW atau DENY)
function catat({ subjek, role = null, metode = null, endpoint, deviceId = null, keputusan, alasan }) {
  try {
    simpan.run(waktuSekarang(), subjek, role, metode, endpoint, deviceId, keputusan, alasan);
  } catch (err) {
    console.error('[AUDIT] gagal menulis audit:', err.message);
  }
  console.log(`[AUDIT] ${keputusan} | ${subjek} | ${metode || '-'} ${endpoint} | ${alasan}`);
}

module.exports = { catat };