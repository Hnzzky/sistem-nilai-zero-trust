// Policy Engine (PE) - VERSI TAHAP 6.
// Memutuskan ALLOW/DENY berdasarkan: role, kepemilikan data (dibaca dari database),
// status nilai, dan jam akses (dari .env).
//
// Prinsip: DEFAULT DENY. Endpoint yang tidak ada di tabel ATURAN selalu ditolak.

const db = require('../database/db');
const config = require('../shared/config');

// ---------- Query database (disiapkan sekali) ----------
const ambilNilai = db.prepare(`
  SELECT n.id, n.status, n.kelas_id, k.dosen_id
  FROM nilai n JOIN kelas k ON k.id = n.kelas_id
  WHERE n.id = ?
`);
const ambilKelas = db.prepare('SELECT id, dosen_id FROM kelas WHERE id = ?');

// ---------- Pembantu hasil keputusan ----------
const izinkan = (reason) => ({ allow: true, reason });
const tolak = (status, reason) => ({ allow: false, status, reason });

// ---------- Jam akses ----------
function formatJam(angka) {
  const jam = Math.floor(angka);
  const menit = Math.round((angka - jam) * 60);
  return `${String(jam).padStart(2, '0')}.${String(menit).padStart(2, '0')}`;
}

// Memeriksa apakah waktu 'now' berada dalam rentang jam akses (zona waktu dari .env)
function periksaJamAkses(now = new Date()) {
  const { start, end, timezone } = config.accessHours;
  const bagian = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const jam = Number(bagian.find((p) => p.type === 'hour').value);
  const menit = Number(bagian.find((p) => p.type === 'minute').value);
  const desimal = jam + menit / 60;

  return {
    dalam: desimal >= start && desimal < end,
    sekarang: `${String(jam).padStart(2, '0')}.${String(menit).padStart(2, '0')} ${timezone}`,
    rentang: `${formatJam(start)}-${formatJam(end)}`,
  };
}

// ---------- Pemeriksaan khusus per endpoint ----------

// GET /nilai
function periksaLihatNilai({ subject, query }) {
  if (subject.role === 'mahasiswa') {
    if (query.nim !== undefined) {
      if (typeof query.nim !== 'string' || query.nim !== subject.nim) {
        return tolak(403, `mahasiswa NIM ${subject.nim} tidak boleh melihat nilai NIM lain`);
      }
    }
    return izinkan(`mahasiswa NIM ${subject.nim} melihat nilai miliknya sendiri`);
  }

  // dosen
  if (query.kelas_id !== undefined) {
    if (typeof query.kelas_id !== 'string' || !/^\d{1,9}$/.test(query.kelas_id)) {
      return tolak(400, 'parameter kelas_id tidak valid');
    }
    const kelas = ambilKelas.get(Number(query.kelas_id));
    if (!kelas) return tolak(404, `kelas ${query.kelas_id} tidak ditemukan`);
    if (kelas.dosen_id !== subject.id) {
      return tolak(403, `${subject.username} bukan pengampu kelas ${kelas.id}`);
    }
    return izinkan(`dosen ${subject.username} melihat nilai kelas ${kelas.id} yang diampunya`);
  }
  return izinkan(`dosen ${subject.username} melihat nilai (dibatasi ke kelas yang diampu oleh service)`);
}

// PUT /nilai/:id
function periksaUbahNilai({ subject, params, now }) {
  const id = Number(params[0]);
  const nilai = ambilNilai.get(id);

  if (!nilai) return tolak(404, `nilai id ${id} tidak ditemukan`);

  if (nilai.dosen_id !== subject.id) {
    return tolak(403, `${subject.username} bukan pengampu kelas ${nilai.kelas_id} (nilai id ${id})`);
  }

  if (nilai.status === 'final') {
    return tolak(403, `nilai id ${id} sudah final dan tidak dapat diubah`);
  }

  const jam = periksaJamAkses(now);
  if (!jam.dalam) {
    return tolak(403, `di luar jam akses (sekarang ${jam.sekarang}, diizinkan ${jam.rentang})`);
  }

  return izinkan(
    `dosen ${subject.username} pengampu kelas ${nilai.kelas_id}, nilai id ${id} belum final, dalam jam akses (${jam.rentang})`
  );
}

// POST /kelas/:id/finalisasi
function periksaFinalisasi({ subject, params, now }) {
  const id = Number(params[0]);
  const kelas = ambilKelas.get(id);

  if (!kelas) return tolak(404, `kelas ${id} tidak ditemukan`);

  if (kelas.dosen_id !== subject.id) {
    return tolak(403, `${subject.username} bukan pengampu kelas ${id}`);
  }

  const jam = periksaJamAkses(now);
  if (!jam.dalam) {
    return tolak(403, `di luar jam akses (sekarang ${jam.sekarang}, diizinkan ${jam.rentang})`);
  }

  return izinkan(`dosen ${subject.username} pengampu kelas ${id}, dalam jam akses (${jam.rentang})`);
}

// GET /transkrip/:nim
function periksaLihatTranskrip({ subject, params }) {
  let nim;
  try {
    nim = decodeURIComponent(params[0]);
  } catch {
    return tolak(400, 'NIM pada URL tidak valid');
  }

  if (subject.role === 'admin') {
    return izinkan(`admin boleh melihat transkrip seluruh mahasiswa (NIM ${nim})`);
  }

  // mahasiswa
  if (!subject.nim || nim !== subject.nim) {
    return tolak(403, `mahasiswa NIM ${subject.nim || '-'} tidak boleh melihat transkrip NIM ${nim}`);
  }
  return izinkan(`mahasiswa melihat transkrip NIM miliknya sendiri (${nim})`);
}

// ---------- Tabel aturan ----------
// 'pola' menangkap parameter path (angka/NIM) ke 'params'.
const ATURAN = [
  { nama: 'GET /nilai',                 metode: 'GET',  pola: /^\/nilai\/?$/,                         roles: ['mahasiswa', 'dosen'], periksa: periksaLihatNilai },
  { nama: 'PUT /nilai/:id',             metode: 'PUT',  pola: /^\/nilai\/(\d{1,9})\/?$/,              roles: ['dosen'],              periksa: periksaUbahNilai },
  { nama: 'POST /kelas/:id/finalisasi', metode: 'POST', pola: /^\/kelas\/(\d{1,9})\/finalisasi\/?$/,  roles: ['dosen'],              periksa: periksaFinalisasi },
  { nama: 'GET /transkrip/:nim',        metode: 'GET',  pola: /^\/transkrip\/([^/]+)\/?$/,            roles: ['mahasiswa', 'admin'], periksa: periksaLihatTranskrip },
  { nama: 'POST /transkrip/sinkron',    metode: 'POST', pola: /^\/transkrip\/sinkron\/?$/,            roles: ['service'],            periksa: null },
];

// Input : { subject: { id, username, role, nim }, method, path, query, now }
// Output: { allow: true/false, status: kode HTTP jika DENY, reason: alasan keputusan }
function evaluate({ subject, method, path, query = {}, now = new Date() }) {
  let aturan = null;
  let hasil = null;

  for (const a of ATURAN) {
    if (a.metode !== method) continue;
    const cocok = a.pola.exec(path);
    if (cocok) {
      aturan = a;
      hasil = cocok;
      break;
    }
  }

  if (!aturan) {
    return tolak(403, `tidak ada aturan untuk ${method} ${path} (default deny)`);
  }

  if (!aturan.roles.includes(subject.role)) {
    return tolak(403, `role ${subject.role} tidak diizinkan untuk ${aturan.nama}`);
  }

  if (!aturan.periksa) {
    return izinkan(`role ${subject.role} diizinkan untuk ${aturan.nama}`);
  }

  return aturan.periksa({ subject, params: hasil.slice(1), query, now });
}

module.exports = { evaluate, periksaJamAkses };