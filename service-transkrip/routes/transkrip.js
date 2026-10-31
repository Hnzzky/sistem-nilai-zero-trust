const express = require('express');
const db = require('../../database/db');
const config = require('../../shared/config');
const { wajibRole } = require('../../shared/authMiddleware');
const { keHuruf, hitungRingkasan } = require('../konversi');

const router = express.Router();

const nimDariUser = db.prepare('SELECT nim FROM users WHERE id = ?');
const adaNim = db.prepare('SELECT 1 FROM users WHERE nim = ?');
const daftarTranskrip = db.prepare(`
  SELECT kode_mk, nama_mk, sks, nilai_angka, nilai_huruf, kelas_id, synced_at
  FROM transkrip WHERE nim = ? ORDER BY kode_mk
`);

// Pemeriksaan ulang: item hanya sah jika cocok dengan nilai berstatus FINAL di database
const cariNilaiFinal = db.prepare(`
  SELECT mk.kode AS kode_mk, mk.nama AS nama_mk, mk.sks
  FROM nilai n
  JOIN users u ON u.id = n.mahasiswa_id
  JOIN kelas k ON k.id = n.kelas_id
  JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
  WHERE u.nim = ? AND n.kelas_id = ? AND n.status = 'final' AND n.nilai_angka = ?
`);

const simpan = db.prepare(`
  INSERT INTO transkrip (nim, kode_mk, nama_mk, sks, nilai_angka, nilai_huruf, kelas_id, synced_at)
  VALUES (@nim, @kode_mk, @nama_mk, @sks, @nilai_angka, @nilai_huruf, @kelas_id, @synced_at)
  ON CONFLICT(nim, kelas_id) DO UPDATE SET
    kode_mk = excluded.kode_mk,
    nama_mk = excluded.nama_mk,
    sks = excluded.sks,
    nilai_angka = excluded.nilai_angka,
    nilai_huruf = excluded.nilai_huruf,
    synced_at = excluded.synced_at
`);

// ---------------------------------------------------------------
// POST /transkrip/sinkron   body: { kelas_id, nilai: [{ nim, nilai_angka }] }
// Hanya token service dari Service Nilai.
// ---------------------------------------------------------------
router.post('/sinkron', wajibRole('service'), (req, res) => {
  if (req.auth.sub !== config.serviceClient.id) {
    return res.status(403).json({ error: 'Service ini tidak berhak melakukan sinkron' });
  }

  const { kelas_id, nilai } = req.body || {};
  if (!Number.isInteger(kelas_id) || kelas_id < 1) {
    return res.status(400).json({ error: 'kelas_id wajib berupa bilangan bulat positif' });
  }
  if (!Array.isArray(nilai) || nilai.length === 0 || nilai.length > 500) {
    return res.status(400).json({ error: 'nilai wajib berupa array berisi 1 sampai 500 item' });
  }

  const siap = [];
  const ditolak = [];
  const waktu = new Date().toISOString();

  for (const item of nilai) {
    const nim = item && typeof item.nim === 'string' ? item.nim : null;
    if (!nim || typeof item.nilai_angka !== 'number') {
      ditolak.push({ nim: String(item && item.nim).slice(0, 20), alasan: 'format item tidak valid' });
      continue;
    }
    const baris = cariNilaiFinal.get(nim, kelas_id, item.nilai_angka);
    if (!baris) {
      ditolak.push({ nim, alasan: 'tidak cocok dengan nilai berstatus final di database' });
      continue;
    }
    siap.push({
      nim,
      kode_mk: baris.kode_mk,
      nama_mk: baris.nama_mk,
      sks: baris.sks,
      nilai_angka: item.nilai_angka,
      nilai_huruf: keHuruf(item.nilai_angka),
      kelas_id,
      synced_at: waktu,
    });
  }

  if (ditolak.length > 0) {
    return res.status(422).json({ error: 'Sinkron ditolak, tidak ada data yang disimpan', ditolak });
  }

  db.transaction(() => {
    for (const s of siap) simpan.run(s);
  })();

  return res.json({ message: 'Sinkron transkrip berhasil', kelas_id, jumlah_disimpan: siap.length });
});

// ---------------------------------------------------------------
// GET /transkrip/:nim
// ---------------------------------------------------------------
router.get('/:nim', wajibRole('mahasiswa', 'admin'), (req, res) => {
  const nim = req.params.nim;

  if (req.auth.role === 'mahasiswa') {
    // Pemeriksaan ulang kepemilikan memakai identitas dari token
    const u = nimDariUser.get(Number(req.auth.sub));
    if (!u || u.nim !== nim) {
      return res.status(403).json({ error: 'Mahasiswa hanya boleh melihat transkrip miliknya sendiri' });
    }
  } else if (!adaNim.get(nim)) {
    return res.status(404).json({ error: 'NIM tidak ditemukan' });
  }

  const data = daftarTranskrip.all(nim);
  const { totalSks, ipk } = hitungRingkasan(data);
  return res.json({ nim, jumlah_mk: data.length, total_sks: totalSks, ipk, data });
});

module.exports = router;