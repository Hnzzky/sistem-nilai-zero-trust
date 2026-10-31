const db = require('./db');

console.log('=== Jumlah baris per tabel ===');
const tabel = [
  'users', 'devices', 'mata_kuliah', 'kelas', 'nilai',
  'transkrip', 'refresh_tokens', 'service_clients', 'audit_log',
];
console.table(
  tabel.map((t) => ({ tabel: t, jumlah: db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n }))
);

console.log('=== Users dan device (hash password hanya 7 karakter awal) ===');
console.table(
  db.prepare(`
    SELECT u.id, u.username, u.role, u.nim, d.device_id,
           substr(u.password_hash, 1, 7) AS hash_awal
    FROM users u LEFT JOIN devices d ON d.user_id = u.id
    ORDER BY u.id
  `).all()
);

console.log('=== Kelas dan dosen pengampu ===');
console.table(
  db.prepare(`
    SELECT k.id, mk.kode, mk.nama AS mata_kuliah, k.nama_kelas, u.username AS dosen
    FROM kelas k
    JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
    JOIN users u ON u.id = k.dosen_id
    ORDER BY k.id
  `).all()
);

console.log('=== Nilai ===');
console.table(
  db.prepare(`
    SELECT n.id, n.kelas_id, u.username AS mahasiswa, u.nim, n.nilai_angka, n.status
    FROM nilai n JOIN users u ON u.id = n.mahasiswa_id
    ORDER BY n.id
  `).all()
);