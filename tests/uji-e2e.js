// Pengujian end-to-end lewat API Gateway (port 3000).
// Syarat: database dalam kondisi awal (npm run seed) dan ketiga server menyala.

const config = require('../shared/config');
const db = require('../database/db');
const { periksaJamAkses } = require('../gateway/policy');

const GW = config.urls.gateway;
let total = 0;
let gagal = 0;
let dilewati = 0;

// ---------- Pembantu ----------
async function kirim(metode, path, { token, device, body, headers } = {}) {
  const h = { ...(headers || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  if (device) h['X-Device-ID'] = device;
  let isi;
  if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    isi = JSON.stringify(body);
  }
  const res = await fetch(GW + path, { method: metode, headers: h, body: isi, signal: AbortSignal.timeout(15000) });
  const teks = await res.text();
  let data;
  try { data = JSON.parse(teks); } catch { data = { raw: teks }; }
  return { status: res.status, data };
}

function catat(nama, lulus, rinci) {
  total += 1;
  if (!lulus) gagal += 1;
  console.log(`${String(total).padStart(2)}. ${lulus ? 'LULUS' : 'GAGAL'} | ${nama}\n      ${rinci}`);
}

// Memeriksa status HTTP (dan syarat tambahan pada isi response)
function harap(nama, r, statusDiharapkan, syarat) {
  const alasan = r.data.alasan || r.data.error || r.data.message || '';
  const statusCocok = r.status === statusDiharapkan;
  const isiCocok = syarat ? Boolean(syarat(r.data)) : true;
  catat(nama, statusCocok && isiCocok, `HTTP ${r.status} (harapan ${statusDiharapkan})${alasan ? ' - ' + alasan : ''}${statusCocok && !isiCocok ? ' - isi response tidak sesuai' : ''}`);
}

function lewati(nama, alasan) {
  dilewati += 1;
  console.log(`--  DILEWATI | ${nama}\n      ${alasan}`);
}

function bagian(judul) {
  console.log(`\n=== ${judul} ===`);
}

const decode = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
const login = (u, p, d) => kirim('POST', '/auth/login', { device: d, body: { username: u, password: p } });

const DEV = { mhs1: 'MHS-DEVICE-001', dosen1: 'DOSEN-DEVICE-001', dosen2: 'DOSEN-DEVICE-002', admin: 'ADMIN-DEVICE-001' };

// ---------- Program utama ----------
async function main() {
  // Prasyarat
  try {
    await fetch(`${GW}/health`, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error('Gateway tidak dapat dihubungi. Jalankan ketiga server dulu.');
    process.exit(2);
  }
  const adaFinal = db.prepare("SELECT COUNT(*) AS n FROM nilai WHERE status = 'final'").get().n;
  const adaTranskrip = db.prepare('SELECT COUNT(*) AS n FROM transkrip').get().n;
  if (adaFinal > 0 || adaTranskrip > 0) {
    console.error('Database bukan kondisi awal (sudah ada nilai final atau isi transkrip).');
    console.error('Jalankan: npm run seed, restart ketiga server, lalu ulangi npm run test:e2e.');
    process.exit(2);
  }

  const jam = periksaJamAkses();
  const dalamJam = jam.dalam;
  console.log(`Waktu sekarang ${jam.sekarang}, jam akses ${jam.rentang} -> ${dalamJam ? 'DALAM jam akses' : 'DI LUAR jam akses'}`);

  // ===== A. Autentikasi =====
  bagian('A. Autentikasi dan token');
  const lm1 = await login('mhs1', 'Mhs#123', DEV.mhs1);
  harap('Login mhs1 (kredensial dan device benar)', lm1, 200, (d) => d.accessToken && d.refreshToken);
  const m1 = lm1.data.accessToken;
  const refreshM1 = lm1.data.refreshToken;

  if (m1) {
    const p = decode(m1);
    catat('Access token: role mahasiswa, tipe user, berlaku 10 menit', p.role === 'mahasiswa' && p.tipe === 'user' && p.exp - p.iat === 600, `role=${p.role}, tipe=${p.tipe}, exp-iat=${p.exp - p.iat} detik`);
  }

  const d1 = (await login('dosen1', 'Dosen#123', DEV.dosen1)).data.accessToken;
  const d2 = (await login('dosen2', 'Dosen#123', DEV.dosen2)).data.accessToken;
  const ad = (await login('admin', 'Admin#123', DEV.admin)).data.accessToken;
  catat('Login dosen1, dosen2, dan admin menghasilkan token', Boolean(d1 && d2 && ad), `dosen1=${Boolean(d1)}, dosen2=${Boolean(d2)}, admin=${Boolean(ad)}`);

  harap('Login password salah', await login('mhs1', 'salah', DEV.mhs1), 401);
  harap('Login device tidak terdaftar', await login('mhs1', 'Mhs#123', 'HP-ASING-999'), 403);
  harap('Login tanpa header X-Device-ID', await login('mhs1', 'Mhs#123', undefined), 403);
  harap('Login dengan device milik user lain', await login('mhs1', 'Mhs#123', DEV.dosen1), 403);

  harap('Refresh dengan token dan device yang benar', await kirim('POST', '/auth/refresh', { device: DEV.mhs1, body: { refreshToken: refreshM1 } }), 200, (d) => d.accessToken);
  harap('Refresh dari device lain', await kirim('POST', '/auth/refresh', { device: DEV.dosen1, body: { refreshToken: refreshM1 } }), 403);

  const rs = await kirim('POST', '/auth/service', { body: { client_id: config.serviceClient.id, client_secret: config.serviceClient.secret } });
  harap('Token service (client_id dan secret benar)', rs, 200, (d) => d.serviceToken);
  const s = rs.data.serviceToken;
  if (s) {
    const p = decode(s);
    catat('Token service: role service, berlaku 5 menit', p.role === 'service' && p.exp - p.iat === 300, `role=${p.role}, exp-iat=${p.exp - p.iat} detik`);
  }
  harap('Token service dengan secret salah', await kirim('POST', '/auth/service', { body: { client_id: config.serviceClient.id, client_secret: 'salah' } }), 401);

  // ===== B. Pemeriksaan gateway =====
  bagian('B. Pemeriksaan di gateway (token, device, default deny)');
  harap('GET /nilai tanpa token', await kirim('GET', '/nilai', { device: DEV.mhs1 }), 401);
  harap('GET /nilai token palsu', await kirim('GET', '/nilai', { token: 'abc.def.ghi', device: DEV.mhs1 }), 401);
  harap('GET /nilai device tidak terdaftar', await kirim('GET', '/nilai', { token: m1, device: 'HP-ASING-999' }), 403);
  harap('GET /nilai tanpa X-Device-ID', await kirim('GET', '/nilai', { token: m1 }), 403);
  harap('GET /abc (tidak ada aturan, default deny)', await kirim('GET', '/abc', { token: m1, device: DEV.mhs1 }), 403);
  harap('Token service dipakai untuk GET /nilai', await kirim('GET', '/nilai', { token: s }), 403);

  // ===== C. Nilai dan kepemilikan =====
  bagian('C. Nilai: role dan kepemilikan data');
  harap('mhs1 GET /nilai (hanya miliknya)', await kirim('GET', '/nilai', { token: m1, device: DEV.mhs1 }), 200,
    (d) => d.jumlah === 2 && d.data.every((x) => x.nim === '2210001'));
  harap('dosen1 GET /nilai (hanya kelas 1)', await kirim('GET', '/nilai', { token: d1, device: DEV.dosen1 }), 200,
    (d) => d.jumlah === 3 && d.data.every((x) => x.kelas_id === 1));
  harap('mhs1 GET /nilai?nim=2210002 (nilai orang lain)', await kirim('GET', '/nilai?nim=2210002', { token: m1, device: DEV.mhs1 }), 403);
  harap('dosen1 GET /nilai?kelas_id=2 (kelas dosen2)', await kirim('GET', '/nilai?kelas_id=2', { token: d1, device: DEV.dosen1 }), 403);
  harap('mhs1 PUT /nilai/1 (role mahasiswa)', await kirim('PUT', '/nilai/1', { token: m1, device: DEV.mhs1, body: { nilai_angka: 99 } }), 403);
  harap('dosen2 PUT /nilai/1 (kelas dosen1)', await kirim('PUT', '/nilai/1', { token: d2, device: DEV.dosen2, body: { nilai_angka: 10 } }), 403);
  harap('dosen1 PUT /nilai/999 (tidak ada)', await kirim('PUT', '/nilai/999', { token: d1, device: DEV.dosen1, body: { nilai_angka: 50 } }), 404);
  harap('dosen1 finalisasi kelas 2 (kelas dosen2)', await kirim('POST', '/kelas/2/finalisasi', { token: d1, device: DEV.dosen1 }), 403);

  // ===== D. Transkrip sebelum finalisasi =====
  bagian('D. Transkrip dan sinkron (sebelum finalisasi)');
  harap('mhs1 GET transkrip sendiri (masih kosong)', await kirim('GET', '/transkrip/2210001', { token: m1, device: DEV.mhs1 }), 200, (d) => d.jumlah_mk === 0);
  harap('mhs1 GET transkrip mhs2', await kirim('GET', '/transkrip/2210002', { token: m1, device: DEV.mhs1 }), 403);
  harap('admin GET transkrip mhs2', await kirim('GET', '/transkrip/2210002', { token: ad, device: DEV.admin }), 200);
  harap('admin GET NIM yang tidak ada', await kirim('GET', '/transkrip/9999999', { token: ad, device: DEV.admin }), 404);
  harap('dosen1 GET transkrip (role dosen)', await kirim('GET', '/transkrip/2210001', { token: d1, device: DEV.dosen1 }), 403);
  harap('Token USER untuk POST /transkrip/sinkron', await kirim('POST', '/transkrip/sinkron', { token: m1, device: DEV.mhs1, body: { kelas_id: 1, nilai: [{ nim: '2210001', nilai_angka: 85 }] } }), 403);
  harap('Token service, nilai belum final', await kirim('POST', '/transkrip/sinkron', { token: s, body: { kelas_id: 1, nilai: [{ nim: '2210001', nilai_angka: 85 }] } }), 422);

  // ===== E. Ubah nilai, finalisasi, sinkron =====
  bagian('E. Ubah nilai, finalisasi, dan sinkron (bergantung jam akses)');
  if (dalamJam) {
    harap('dosen1 PUT /nilai/1 dengan nilai 150 (tidak valid)', await kirim('PUT', '/nilai/1', { token: d1, device: DEV.dosen1, body: { nilai_angka: 150 } }), 400);
    harap('dosen1 PUT /nilai/1 jadi 95 (dalam jam akses)', await kirim('PUT', '/nilai/1', { token: d1, device: DEV.dosen1, body: { nilai_angka: 95 } }), 200, (d) => d.data.nilai_angka === 95);
    harap('dosen1 finalisasi kelas 1', await kirim('POST', '/kelas/1/finalisasi', { token: d1, device: DEV.dosen1 }), 200,
      (d) => d.nilai_difinalisasi === 3 && d.sinkron_transkrip.status === 'berhasil' && d.sinkron_transkrip.jumlah_disimpan === 3);
    harap('dosen1 PUT /nilai/1 setelah final', await kirim('PUT', '/nilai/1', { token: d1, device: DEV.dosen1, body: { nilai_angka: 50 } }), 403,
      () => true);
    harap('Token service, nilai dipalsukan (100)', await kirim('POST', '/transkrip/sinkron', { token: s, body: { kelas_id: 1, nilai: [{ nim: '2210001', nilai_angka: 100 }] } }), 422);
    harap('Token service, nilai cocok dan final (idempoten)', await kirim('POST', '/transkrip/sinkron', { token: s, body: { kelas_id: 1, nilai: [{ nim: '2210001', nilai_angka: 95 }] } }), 200, (d) => d.jumlah_disimpan === 1);
    harap('mhs1 GET transkrip setelah finalisasi', await kirim('GET', '/transkrip/2210001', { token: m1, device: DEV.mhs1 }), 200,
      (d) => d.jumlah_mk === 1 && d.data[0].nilai_angka === 95 && d.data[0].nilai_huruf === 'A' && d.ipk === 4);
    harap('admin GET transkrip mhs2 setelah finalisasi', await kirim('GET', '/transkrip/2210002', { token: ad, device: DEV.admin }), 200,
      (d) => d.jumlah_mk === 1 && d.data[0].nilai_huruf === 'B');
    const jumlahTranskrip = db.prepare('SELECT COUNT(*) AS n FROM transkrip').get().n;
    catat('Tabel transkrip berisi 3 baris (tanpa data ganda)', jumlahTranskrip === 3, `jumlah baris = ${jumlahTranskrip}`);
  } else {
    harap('dosen1 PUT /nilai/1 di luar jam akses', await kirim('PUT', '/nilai/1', { token: d1, device: DEV.dosen1, body: { nilai_angka: 95 } }), 403,
      (d) => String(d.alasan).includes('di luar jam akses'));
    harap('dosen1 finalisasi kelas 1 di luar jam akses', await kirim('POST', '/kelas/1/finalisasi', { token: d1, device: DEV.dosen1 }), 403,
      (d) => String(d.alasan).includes('di luar jam akses'));
    lewati('Ubah nilai, finalisasi, dan sinkron penuh', 'Sekarang di luar jam akses. Ubah ACCESS_HOUR_END di .env (misalnya 24), restart gateway, npm run seed, restart semua server, lalu ulangi.');
  }

  // ===== F. Logout =====
  bagian('F. Logout');
  harap('Logout mhs1 (refresh token dicabut)', await kirim('POST', '/auth/logout', { body: { refreshToken: refreshM1 } }), 200);
  harap('Refresh setelah logout', await kirim('POST', '/auth/refresh', { device: DEV.mhs1, body: { refreshToken: refreshM1 } }), 401);

  // ===== G. Audit log =====
  bagian('G. Audit log');
  const ringkas = db.prepare('SELECT keputusan, COUNT(*) AS n FROM audit_log GROUP BY keputusan').all();
  const allow = (ringkas.find((x) => x.keputusan === 'ALLOW') || {}).n || 0;
  const deny = (ringkas.find((x) => x.keputusan === 'DENY') || {}).n || 0;
  catat('Audit log memuat keputusan ALLOW dan DENY', allow > 0 && deny > 0, `ALLOW=${allow}, DENY=${deny}`);
  const tanpaAlasan = db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE alasan IS NULL OR alasan = ''").get().n;
  catat('Setiap baris audit punya alasan', tanpaAlasan === 0, `baris tanpa alasan = ${tanpaAlasan}`);

  // ===== Ringkasan =====
  console.log(`\nTotal ${total} pengecekan, ${total - gagal} lulus, ${gagal} gagal, ${dilewati} bagian dilewati.`);
  if (gagal === 0 && dilewati === 0) console.log('Semua pengecekan lulus.');
  console.log('Catatan: data berubah (nilai final). Untuk mengulang: npm run seed, restart ketiga server.');
  process.exit(gagal === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Pengujian berhenti karena error:', err.message);
  process.exit(2);
});