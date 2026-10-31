const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const config = require('../shared/config');
const db = require('./db');

// ---------- 1. Reset: hapus tabel lama lalu buat ulang dari schema.sql ----------
const urutanHapus = [
  'audit_log', 'service_clients', 'refresh_tokens', 'transkrip',
  'nilai', 'kelas', 'mata_kuliah', 'devices', 'users',
];

db.pragma('foreign_keys = OFF');
for (const tabel of urutanHapus) {
  db.exec(`DROP TABLE IF EXISTS ${tabel}`);
}
db.pragma('foreign_keys = ON');

db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// ---------- 2. Data akun (khusus demo/praktikum) ----------
const akun = [
  { username: 'admin',  password: 'Admin#123', role: 'admin',     nama: 'Admin Prodi',        nim: null,      device: 'ADMIN-DEVICE-001' },
  { username: 'dosen1', password: 'Dosen#123', role: 'dosen',     nama: 'Dr. Budi Santoso',   nim: null,      device: 'DOSEN-DEVICE-001' },
  { username: 'dosen2', password: 'Dosen#123', role: 'dosen',     nama: 'Dr. Siti Rahayu',    nim: null,      device: 'DOSEN-DEVICE-002' },
  { username: 'mhs1',   password: 'Mhs#123',   role: 'mahasiswa', nama: 'Andi Pratama',       nim: '2210001', device: 'MHS-DEVICE-001' },
  { username: 'mhs2',   password: 'Mhs#123',   role: 'mahasiswa', nama: 'Rina Wulandari',     nim: '2210002', device: 'MHS-DEVICE-002' },
  { username: 'mhs3',   password: 'Mhs#123',   role: 'mahasiswa', nama: 'Dewi Lestari',       nim: '2210003', device: 'MHS-DEVICE-003' },
];

const mataKuliah = [
  { kode: 'IF101', nama: 'Keamanan Informasi', sks: 3 },
  { kode: 'IF102', nama: 'Basis Data',         sks: 3 },
];

// dosen1 mengampu kelas 1, dosen2 mengampu kelas 2
const kelas = [
  { mk: 'IF101', dosen: 'dosen1', nama_kelas: 'A', semester: '2026/2027 Ganjil' },
  { mk: 'IF102', dosen: 'dosen2', nama_kelas: 'A', semester: '2026/2027 Ganjil' },
];

// nilai awal semua berstatus draft
const nilai = [
  { kelas: 1, mhs: 'mhs1', angka: 85 },
  { kelas: 1, mhs: 'mhs2', angka: 78 },
  { kelas: 1, mhs: 'mhs3', angka: 90 },
  { kelas: 2, mhs: 'mhs1', angka: 80 },
  { kelas: 2, mhs: 'mhs2', angka: 88 },
  { kelas: 2, mhs: 'mhs3', angka: 72 },
];

// ---------- 3. Isi data dalam satu transaksi (semua berhasil atau semua batal) ----------
const isiData = db.transaction(() => {
  const idUser = {};
  const idMk = {};

  const insUser = db.prepare(
    'INSERT INTO users (username, password_hash, role, nama, nim) VALUES (?, ?, ?, ?, ?)'
  );
  const insDevice = db.prepare('INSERT INTO devices (user_id, device_id) VALUES (?, ?)');

  for (const a of akun) {
    const hash = bcrypt.hashSync(a.password, 10);
    const info = insUser.run(a.username, hash, a.role, a.nama, a.nim);
    idUser[a.username] = Number(info.lastInsertRowid);
    insDevice.run(idUser[a.username], a.device);
  }

  const insMk = db.prepare('INSERT INTO mata_kuliah (kode, nama, sks) VALUES (?, ?, ?)');
  for (const m of mataKuliah) {
    const info = insMk.run(m.kode, m.nama, m.sks);
    idMk[m.kode] = Number(info.lastInsertRowid);
  }

  const insKelas = db.prepare(
    'INSERT INTO kelas (mata_kuliah_id, dosen_id, nama_kelas, semester) VALUES (?, ?, ?, ?)'
  );
  for (const k of kelas) {
    insKelas.run(idMk[k.mk], idUser[k.dosen], k.nama_kelas, k.semester);
  }

  const insNilai = db.prepare(
    "INSERT INTO nilai (kelas_id, mahasiswa_id, nilai_angka, status) VALUES (?, ?, ?, 'draft')"
  );
  for (const n of nilai) {
    insNilai.run(n.kelas, idUser[n.mhs], n.angka);
  }

  // Kredensial Service Nilai untuk POST /auth/service (secret di-hash)
  db.prepare('INSERT INTO service_clients (client_id, secret_hash, nama) VALUES (?, ?, ?)').run(
    config.serviceClient.id,
    bcrypt.hashSync(config.serviceClient.secret, 10),
    'Service Nilai'
  );
});

isiData();

// ---------- 4. Tampilkan ringkasan akun untuk pengujian ----------
console.log('Seed database selesai.\n');
console.log('Akun untuk pengujian Postman:');
console.table(
  akun.map((a) => ({
    username: a.username,
    password: a.password,
    role: a.role,
    nim: a.nim || '-',
    'X-Device-ID': a.device,
  }))
);
console.log(`Service client: ${config.serviceClient.id} (secret ada di file .env)`);