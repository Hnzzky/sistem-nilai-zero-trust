// Skala konversi (asumsi): >=85 A, >=70 B, >=55 C, >=40 D, selain itu E
function keHuruf(angka) {
  if (angka >= 85) return 'A';
  if (angka >= 70) return 'B';
  if (angka >= 55) return 'C';
  if (angka >= 40) return 'D';
  return 'E';
}

const BOBOT = { A: 4, B: 3, C: 2, D: 1, E: 0 };

// Mengembalikan total SKS dan IPK (dibulatkan 2 desimal); ipk null jika belum ada data
function hitungRingkasan(baris) {
  const totalSks = baris.reduce((j, b) => j + b.sks, 0);
  if (totalSks === 0) return { totalSks: 0, ipk: null };
  const mutu = baris.reduce((j, b) => j + BOBOT[b.nilai_huruf] * b.sks, 0);
  return { totalSks, ipk: Math.round((mutu / totalSks) * 100) / 100 };
}

module.exports = { keHuruf, hitungRingkasan };