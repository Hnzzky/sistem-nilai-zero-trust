const config = require('../shared/config');

const BATAS_WAKTU_MS = 8000;

// Langkah 1: minta token service ke gateway (diaudit gateway sebagai service:service-nilai)
async function ambilTokenService() {
  const res = await fetch(`${config.urls.gateway}/auth/service`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.serviceClient.id,
      client_secret: config.serviceClient.secret,
    }),
    signal: AbortSignal.timeout(BATAS_WAKTU_MS),
  });
  if (!res.ok) throw new Error(`gagal mendapat token service (HTTP ${res.status})`);
  const data = await res.json();
  return data.serviceToken;
}

// Langkah 2: kirim data ke Service Transkrip LEWAT GATEWAY dengan token service
async function sinkronTranskrip(kelasId, daftarNilai) {
  const token = await ambilTokenService();

  const res = await fetch(`${config.urls.gateway}/transkrip/sinkron`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ kelas_id: kelasId, nilai: daftarNilai }),
    signal: AbortSignal.timeout(BATAS_WAKTU_MS),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`sinkron ditolak (HTTP ${res.status}): ${data.alasan || data.error || 'tanpa keterangan'}`);
  }
  return data;
}

module.exports = { sinkronTranskrip };