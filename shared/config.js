const path = require('path');

// Membaca file .env di folder root proyek
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Variabel wajib harus ada, kalau tidak aplikasi langsung berhenti
function wajib(nama) {
  const nilai = process.env[nama];
  if (!nilai || nilai.startsWith('GANTI_')) {
    throw new Error(`Variabel ${nama} belum diisi dengan benar di file .env`);
  }
  return nilai;
}

// Ambil angka dari .env dengan nilai cadangan
function angka(nama, cadangan) {
  const nilai = process.env[nama];
  if (nilai === undefined || nilai === '') return cadangan;
  const n = Number(nilai);
  if (Number.isNaN(n)) {
    throw new Error(`Variabel ${nama} harus berupa angka`);
  }
  return n;
}

const config = {
  ports: {
    gateway: angka('GATEWAY_PORT', 3000),
    nilai: angka('NILAI_PORT', 3001),
    transkrip: angka('TRANSKRIP_PORT', 3002),
  },

  urls: {
    gateway: process.env.GATEWAY_URL || 'http://127.0.0.1:3000',
    nilai: process.env.NILAI_URL || 'http://127.0.0.1:3001',
    transkrip: process.env.TRANSKRIP_URL || 'http://127.0.0.1:3002',
  },

  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || 'database/sistem_nilai.db'),

  jwtSecret: wajib('JWT_SECRET'),
  gatewaySecret: wajib('GATEWAY_SECRET'),

  token: {
    accessExpires: process.env.ACCESS_TOKEN_EXPIRES || '10m',
    serviceExpires: process.env.SERVICE_TOKEN_EXPIRES || '5m',
    refreshDays: angka('REFRESH_TOKEN_DAYS', 1),
  },

  accessHours: {
    start: angka('ACCESS_HOUR_START', 7),
    end: angka('ACCESS_HOUR_END', 21),
    timezone: process.env.TIMEZONE || 'Asia/Jakarta',
  },

  serviceClient: {
    id: wajib('SERVICE_CLIENT_ID'),
    secret: wajib('SERVICE_CLIENT_SECRET'),
  },
};

module.exports = config;