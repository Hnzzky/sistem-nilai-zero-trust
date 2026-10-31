// Menguji Policy Engine langsung (tanpa server/Postman).
// Membaca data seed: kelas 1 = dosen1, kelas 2 = dosen2, nilai id 1-3 (kelas 1), 4-6 (kelas 2).
// Jam akses dipaksa 07.00-21.00 Asia/Jakarta selama pengujian, apa pun isi .env.

const config = require('../shared/config');
const db = require('../database/db');
const policy = require('./policy');

config.accessHours.start = 7;
config.accessHours.end = 21;
config.accessHours.timezone = 'Asia/Jakarta';

const ambilUser = db.prepare('SELECT id, username, role, nim FROM users WHERE username = ?');

function user(username) {
  const u = ambilUser.get(username);
  return { tipe: 'user', id: u.id, username: u.username, role: u.role, nim: u.nim, label: `user:${u.username}` };
}
const service = { tipe: 'service', id: 'service-nilai', role: 'service', label: 'service:service-nilai' };

// Waktu palsu pada hari yang sama, zona Asia/Jakarta (UTC+7)
const jam = (hhmm) => new Date(`2026-10-31T${hhmm}:00+07:00`);
const SIANG = jam('10:00');

let no = 0;
let gagal = 0;

function uji(nama, input, harapanAllow) {
  no += 1;
  const h = policy.evaluate(input);
  const lulus = h.allow === harapanAllow;
  if (!lulus) gagal += 1;
  console.log(
    `${String(no).padStart(2)}. ${lulus ? 'LULUS' : 'GAGAL'} | harapan ${harapanAllow ? 'ALLOW' : 'DENY '} | ${nama}\n` +
      `      hasil: ${h.allow ? 'ALLOW' : 'DENY'}${h.status ? ' (' + h.status + ')' : ''} - ${h.reason}`
  );
}

console.log('=== Kepemilikan data: nilai dan transkrip ===');
uji('mhs1 GET /nilai', { subject: user('mhs1'), method: 'GET', path: '/nilai' }, true);
uji('mhs1 GET /nilai?nim=2210001 (miliknya)', { subject: user('mhs1'), method: 'GET', path: '/nilai', query: { nim: '2210001' } }, true);
uji('mhs1 GET /nilai?nim=2210002 (milik orang lain)', { subject: user('mhs1'), method: 'GET', path: '/nilai', query: { nim: '2210002' } }, false);
uji('dosen1 GET /nilai?kelas_id=1 (kelasnya)', { subject: user('dosen1'), method: 'GET', path: '/nilai', query: { kelas_id: '1' } }, true);
uji('dosen1 GET /nilai?kelas_id=2 (kelas dosen2)', { subject: user('dosen1'), method: 'GET', path: '/nilai', query: { kelas_id: '2' } }, false);
uji('mhs1 GET /transkrip/2210001 (miliknya)', { subject: user('mhs1'), method: 'GET', path: '/transkrip/2210001' }, true);
uji('mhs1 GET /transkrip/2210002 (milik orang lain)', { subject: user('mhs1'), method: 'GET', path: '/transkrip/2210002' }, false);
uji('admin GET /transkrip/2210002 (admin boleh semua)', { subject: user('admin'), method: 'GET', path: '/transkrip/2210002' }, true);
uji('dosen1 GET /transkrip/2210001 (role dosen tidak boleh)', { subject: user('dosen1'), method: 'GET', path: '/transkrip/2210001' }, false);

console.log('\n=== Ubah nilai: pengampu, status, jam akses ===');
uji('dosen1 PUT /nilai/1 pukul 10.00', { subject: user('dosen1'), method: 'PUT', path: '/nilai/1', now: SIANG }, true);
uji('dosen2 PUT /nilai/1 (kelas dosen1)', { subject: user('dosen2'), method: 'PUT', path: '/nilai/1', now: SIANG }, false);
uji('dosen1 PUT /nilai/4 (kelas dosen2)', { subject: user('dosen1'), method: 'PUT', path: '/nilai/4', now: SIANG }, false);
uji('dosen1 PUT /nilai/999 (tidak ada)', { subject: user('dosen1'), method: 'PUT', path: '/nilai/999', now: SIANG }, false);
uji('dosen1 PUT /nilai/1 pukul 20.59 (batas dalam)', { subject: user('dosen1'), method: 'PUT', path: '/nilai/1', now: jam('20:59') }, true);
uji('dosen1 PUT /nilai/1 pukul 21.00 (batas luar)', { subject: user('dosen1'), method: 'PUT', path: '/nilai/1', now: jam('21:00') }, false);
uji('dosen1 PUT /nilai/1 pukul 22.00', { subject: user('dosen1'), method: 'PUT', path: '/nilai/1', now: jam('22:00') }, false);
uji('dosen1 PUT /nilai/1 pukul 06.59', { subject: user('dosen1'), method: 'PUT', path: '/nilai/1', now: jam('06:59') }, false);
uji('mhs1 PUT /nilai/1 (role mahasiswa)', { subject: user('mhs1'), method: 'PUT', path: '/nilai/1', now: SIANG }, false);

// Menandai nilai 1 sebagai final HANYA di dalam transaksi, lalu dibatalkan (ROLLBACK)
db.exec('BEGIN');
try {
  db.prepare("UPDATE nilai SET status = 'final' WHERE id = 1").run();
  uji('dosen1 PUT /nilai/1 setelah nilai berstatus final', { subject: user('dosen1'), method: 'PUT', path: '/nilai/1', now: SIANG }, false);
} finally {
  db.exec('ROLLBACK');
}

console.log('\n=== Finalisasi kelas ===');
uji('dosen1 POST /kelas/1/finalisasi pukul 10.00', { subject: user('dosen1'), method: 'POST', path: '/kelas/1/finalisasi', now: SIANG }, true);
uji('dosen1 POST /kelas/2/finalisasi (kelas dosen2)', { subject: user('dosen1'), method: 'POST', path: '/kelas/2/finalisasi', now: SIANG }, false);
uji('dosen1 POST /kelas/1/finalisasi pukul 22.00', { subject: user('dosen1'), method: 'POST', path: '/kelas/1/finalisasi', now: jam('22:00') }, false);

console.log('\n=== Sinkron transkrip: hanya token service ===');
uji('mhs1 POST /transkrip/sinkron (token user)', { subject: user('mhs1'), method: 'POST', path: '/transkrip/sinkron' }, false);
uji('dosen1 POST /transkrip/sinkron (token user)', { subject: user('dosen1'), method: 'POST', path: '/transkrip/sinkron' }, false);
uji('service POST /transkrip/sinkron', { subject: service, method: 'POST', path: '/transkrip/sinkron' }, true);
uji('service GET /nilai (service tidak punya hak ini)', { subject: service, method: 'GET', path: '/nilai' }, false);
uji('mhs1 GET /abc (tidak ada aturan)', { subject: user('mhs1'), method: 'GET', path: '/abc' }, false);

console.log(`\nTotal ${no} uji, ${no - gagal} lulus, ${gagal} gagal.`);
process.exit(gagal === 0 ? 0 : 1);