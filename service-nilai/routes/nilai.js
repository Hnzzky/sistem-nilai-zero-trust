const express = require('express');
const db = require('../../database/db');
const { wajibRole } = require('../../shared/authMiddleware');

const router = express.Router();

const SELECT_DASAR = `
  SELECT n.id, n.kelas_id, mk.kode AS kode_mk, mk.nama AS nama_mk,
         u.nim, u.nama AS nama_mahasiswa, n.nilai_angka, n.status
  FROM nilai n
  JOIN kelas k ON k.id = n.kelas_id
  JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
  JOIN users u ON u.id = n.mahasiswa_id
`;

const nilaiMahasiswa = db.prepare(`${SELECT_DASAR} WHERE n.mahasiswa_id = ? ORDER BY n.kelas_id, n.id`);
const nilaiDosen = db.prepare(`${SELECT_DASAR} WHERE k.dosen_id = ? ORDER BY n.kelas_id, n.id`);
const nilaiDosenPerKelas = db.prepare(
  `${SELECT_DASAR} WHERE k.dosen_id = ? AND n.kelas_id = ? ORDER BY n.id`
);
const ambilSatu = db.prepare(`${SELECT_DASAR} WHERE n.id = ?`);
const ambilKelas = db.prepare('SELECT id, dosen_id FROM kelas WHERE id = ?');

// Pemeriksaan ulang di SQL: hanya berubah jika nilai milik kelas dosen ini DAN masih draft
const ubahNilai = db.prepare(`
  UPDATE nilai SET nilai_angka = ?
  WHERE id = ? AND status = 'draft'
    AND kelas_id IN (SELECT id FROM kelas WHERE dosen_id = ?)
`);
const cekAlasanGagal = db.prepare(`
  SELECT n.status, k.dosen_id FROM nilai n JOIN kelas k ON k.id = n.kelas_id WHERE n.id = ?
`);

// ---------------------------------------------------------------
// GET /nilai
// ---------------------------------------------------------------
router.get('/', wajibRole('mahasiswa', 'dosen'), (req, res) => {
  const idUser = Number(req.auth.sub);

  if (req.auth.role === 'mahasiswa') {
    // Selalu dibatasi ke ID dari token. Parameter ?nim=... diabaikan.
    const data = nilaiMahasiswa.all(idUser);
    return res.json({ role: 'mahasiswa', jumlah: data.length, data });
  }

  // dosen
  if (req.query.kelas_id !== undefined) {
    const k = req.query.kelas_id;
    if (typeof k !== 'string' || !/^\d{1,9}$/.test(k)) {
      return res.status(400).json({ error: 'kelas_id tidak valid' });
    }
    const kelas = ambilKelas.get(Number(k));
    if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan' });
    if (kelas.dosen_id !== idUser) {
      return res.status(403).json({ error: 'Bukan pengampu kelas ini' });
    }
    const data = nilaiDosenPerKelas.all(idUser, kelas.id);
    return res.json({ role: 'dosen', kelas_id: kelas.id, jumlah: data.length, data });
  }

  const data = nilaiDosen.all(idUser);
  return res.json({ role: 'dosen', jumlah: data.length, data });
});

// ---------------------------------------------------------------
// PUT /nilai/:id   body: { "nilai_angka": 0-100 }
// ---------------------------------------------------------------
router.put('/:id', wajibRole('dosen'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'ID nilai tidak valid' });
  }

  const angka = req.body && req.body.nilai_angka;
  if (typeof angka !== 'number' || !Number.isFinite(angka) || angka < 0 || angka > 100) {
    return res.status(400).json({ error: 'nilai_angka wajib berupa angka 0 sampai 100' });
  }

  const idDosen = Number(req.auth.sub);
  const info = ubahNilai.run(angka, id, idDosen);

  if (info.changes === 0) {
    const baris = cekAlasanGagal.get(id);
    if (!baris) return res.status(404).json({ error: 'Nilai tidak ditemukan' });
    if (baris.dosen_id !== idDosen) return res.status(403).json({ error: 'Bukan pengampu kelas ini' });
    if (baris.status === 'final') return res.status(403).json({ error: 'Nilai sudah final dan tidak dapat diubah' });
    return res.status(409).json({ error: 'Nilai tidak dapat diubah' });
  }

  return res.json({ message: 'Nilai berhasil diubah', data: ambilSatu.get(id) });
});

module.exports = router;