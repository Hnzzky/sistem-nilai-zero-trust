// Policy Engine (PE) - VERSI TAHAP 5: baru memeriksa role per endpoint.
// Tahap 6 menambahkan pemeriksaan kepemilikan data, status final, dan jam akses.
//
// Prinsip: DEFAULT DENY. Endpoint yang tidak ada di tabel ATURAN selalu ditolak.

const ATURAN = [
  { nama: 'GET /nilai',                 metode: 'GET',  pola: /^\/nilai\/?$/,                  roles: ['mahasiswa', 'dosen'] },
  { nama: 'PUT /nilai/:id',             metode: 'PUT',  pola: /^\/nilai\/\d+\/?$/,             roles: ['dosen'] },
  { nama: 'POST /kelas/:id/finalisasi', metode: 'POST', pola: /^\/kelas\/\d+\/finalisasi\/?$/, roles: ['dosen'] },
  { nama: 'GET /transkrip/:nim',        metode: 'GET',  pola: /^\/transkrip\/[^/]+\/?$/,       roles: ['mahasiswa', 'admin'] },
  { nama: 'POST /transkrip/sinkron',    metode: 'POST', pola: /^\/transkrip\/sinkron\/?$/,     roles: ['service'] },
];

// Input : { subject: { role, ... }, method, path }
// Output: { allow: true/false, status: kode HTTP jika DENY, reason: alasan keputusan }
function evaluate({ subject, method, path }) {
  const aturan = ATURAN.find((a) => a.metode === method && a.pola.test(path));

  if (!aturan) {
    return { allow: false, status: 403, reason: `tidak ada aturan untuk ${method} ${path} (default deny)` };
  }

  if (!aturan.roles.includes(subject.role)) {
    return {
      allow: false,
      status: 403,
      reason: `role ${subject.role} tidak diizinkan untuk ${aturan.nama}`,
    };
  }

  return { allow: true, reason: `role ${subject.role} diizinkan untuk ${aturan.nama}` };
}

module.exports = { evaluate };