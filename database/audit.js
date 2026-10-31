const db = require('./db');

console.log('=== 20 audit terakhir ===');
console.table(
  db.prepare(`
    SELECT id, waktu, subjek, metode, endpoint, device_id, keputusan, alasan
    FROM audit_log ORDER BY id DESC LIMIT 20
  `).all()
);