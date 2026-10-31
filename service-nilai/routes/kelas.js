const express = require('express');
const db = require('../../database/db');
const { wajibRole } = require('../../shared/authMiddleware');
const { sinkronTranskrip } = require('../gatewayClient');

const router = express.Router();

const ambilKelas = db.prepare('SELECT id, dosen_id FROM kelas WHERE id = ?');
const finalkan = db.prepare("UPDATE nilai SET status = 'final' WHERE kelas_id = ? AND status = 'draft'");
const hitungNilai = db.prepare('SELECT COUNT(*) AS total FROM nilai WHERE kelas_id = ?');
const nilaiFinalKelas = db.prepare(`
  SELECT u.nim, n.nilai_angka
  FROM nilai n JOIN users u ON u.id = n.mahasiswa_id
  WHERE n.kelas_id = ? AND n.status = 'final'
  ORDER BY u.nim
`);

// ---------------------------------------------------------------
// POST /kelas/:id/finalisasi
// ---------------------------------------------------------------
router.post('/:id/finalisasi', wajibRole('dosen'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'ID kelas tidak valid' });
  }

  const kelas = ambilKelas.get(id);
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan' });

  // Pemeriksaan ulang kepemilikan (assume breach)
  if (kelas.dosen_id !== Number(req.auth.sub)) {
    return res.status(403).json({ error: 'Bukan pengampu kelas ini' });
  }

  const jumlahBaru = db.transaction(() => finalkan.run(id).changes)();
  const total = hitungNilai.get(id).total;
  const daftarFinal = nilaiFinalKelas.all(id);

  // Kirim SEMUA nilai final kelas ini, jadi memanggil finalisasi ulang = mencoba sinkron ulang
  let sinkron;
  if (daftarFinal.length === 0) {
    sinkron = { status: 'dilewati', keterangan: 'tidak ada nilai final di kelas ini' };
  } else {
    try {
      const hasil = await sinkronTranskrip(id, daftarFinal);
      sinkron = { status: 'berhasil', jumlah_disimpan: hasil.jumlah_disimpan };
    } catch (err) {
      console.error(`[SERVICE NILAI] sinkron transkrip gagal: ${err.message}`);
      return res.status(502).json({
        error: 'Nilai sudah final, tetapi sinkron ke transkrip gagal. Ulangi finalisasi untuk mencoba lagi.',
        kelas_id: id,
        nilai_difinalisasi: jumlahBaru,
        detail: err.message,
      });
    }
  }

  return res.json({
    message: 'Finalisasi selesai',
    kelas_id: id,
    nilai_difinalisasi: jumlahBaru,
    total_nilai_di_kelas: total,
    sinkron_transkrip: sinkron,
  });
});

module.exports = router;