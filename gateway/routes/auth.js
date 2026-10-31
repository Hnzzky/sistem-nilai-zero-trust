const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../../database/db');
const config = require('../../shared/config');
const tokens = require('../../shared/tokens');
const { catat } = require('../auditLog');

const router = express.Router();

// Hash palsu: dipakai supaya bcrypt.compare tetap berjalan walau username tidak ada
const HASH_PALSU = bcrypt.hashSync('hash-palsu-untuk-penyamaran', 10);

function ambilDevice(req) {
  const d = req.get('X-Device-ID');
  return d ? d.trim() : null;
}

function potong(teks) {
  return String(teks).slice(0, 64);
}

// Pembantu pencatatan audit untuk semua endpoint auth
function audit(req, subjek, role, keputusan, alasan) {
  catat({
    subjek,
    role,
    metode: req.method,
    endpoint: req.originalUrl.split('?')[0],
    deviceId: ambilDevice(req),
    keputusan,
    alasan,
  });
}

// ---------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    audit(req, 'anonim', null, 'DENY', 'username atau password tidak diisi');
    return res.status(400).json({ error: 'username dan password wajib diisi' });
  }

  const subjek = `user:${potong(username)}`;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const passwordBenar = await bcrypt.compare(password, user ? user.password_hash : HASH_PALSU);

  if (!user || !passwordBenar) {
    audit(req, subjek, null, 'DENY', user ? 'password salah' : 'username tidak ditemukan');
    return res.status(401).json({ error: 'Kredensial tidak valid' });
  }

  const deviceId = ambilDevice(req);
  if (!deviceId) {
    audit(req, subjek, user.role, 'DENY', 'header X-Device-ID tidak ada');
    return res.status(403).json({ error: 'Header X-Device-ID wajib diisi' });
  }

  const terdaftar = db
    .prepare('SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?')
    .get(user.id, deviceId);
  if (!terdaftar) {
    audit(req, subjek, user.role, 'DENY', 'device tidak terdaftar untuk user ini');
    return res.status(403).json({ error: 'Device tidak terdaftar' });
  }

  const accessToken = tokens.buatAccessToken(user);
  const refreshToken = tokens.buatRefreshToken();
  const kedaluwarsa = new Date(Date.now() + config.token.refreshDays * 24 * 60 * 60 * 1000);

  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, device_id, expires_at) VALUES (?, ?, ?, ?)'
  ).run(user.id, tokens.hashRefreshToken(refreshToken), deviceId, kedaluwarsa.toISOString());

  audit(req, subjek, user.role, 'ALLOW', 'login berhasil: kredensial valid dan device terdaftar');
  res.json({
    tokenType: 'Bearer',
    accessToken,
    accessTokenExpiresIn: config.token.accessExpires,
    refreshToken,
    refreshTokenExpiresAt: kedaluwarsa.toISOString(),
    user: { username: user.username, nama: user.nama, role: user.role },
  });
});

// ---------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {};

  if (typeof refreshToken !== 'string' || !refreshToken) {
    audit(req, 'anonim', null, 'DENY', 'refreshToken tidak diisi');
    return res.status(400).json({ error: 'refreshToken wajib diisi' });
  }

  const baris = db
    .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?')
    .get(tokens.hashRefreshToken(refreshToken));

  if (!baris) {
    audit(req, 'anonim', null, 'DENY', 'refresh token tidak dikenal');
    return res.status(401).json({ error: 'Refresh token tidak valid' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(baris.user_id);
  const subjek = `user:${user.username}`;

  if (baris.revoked === 1) {
    audit(req, subjek, user.role, 'DENY', 'refresh token sudah dicabut');
    return res.status(401).json({ error: 'Refresh token sudah dicabut' });
  }

  if (new Date(baris.expires_at) < new Date()) {
    audit(req, subjek, user.role, 'DENY', 'refresh token kedaluwarsa');
    return res.status(401).json({ error: 'Refresh token kedaluwarsa' });
  }

  const deviceId = ambilDevice(req);
  if (!deviceId || deviceId !== baris.device_id) {
    audit(req, subjek, user.role, 'DENY', 'device tidak sama dengan device saat login');
    return res.status(403).json({ error: 'Device tidak sesuai' });
  }

  // Device harus masih terdaftar (bisa saja dihapus setelah login)
  const terdaftar = db
    .prepare('SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?')
    .get(user.id, deviceId);
  if (!terdaftar) {
    audit(req, subjek, user.role, 'DENY', 'device tidak lagi terdaftar');
    return res.status(403).json({ error: 'Device tidak terdaftar' });
  }

  audit(req, subjek, user.role, 'ALLOW', 'refresh berhasil: token valid, belum dicabut, device sama');
  res.json({
    tokenType: 'Bearer',
    accessToken: tokens.buatAccessToken(user),
    accessTokenExpiresIn: config.token.accessExpires,
  });
});

// ---------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body || {};

  if (typeof refreshToken !== 'string' || !refreshToken) {
    audit(req, 'anonim', null, 'DENY', 'refreshToken tidak diisi');
    return res.status(400).json({ error: 'refreshToken wajib diisi' });
  }

  const baris = db
    .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?')
    .get(tokens.hashRefreshToken(refreshToken));

  if (!baris) {
    audit(req, 'anonim', null, 'DENY', 'refresh token tidak dikenal');
    return res.status(401).json({ error: 'Refresh token tidak valid' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(baris.user_id);
  const subjek = `user:${user.username}`;

  if (baris.revoked === 1) {
    audit(req, subjek, user.role, 'DENY', 'refresh token sudah dicabut sebelumnya');
    return res.status(401).json({ error: 'Refresh token sudah dicabut' });
  }

  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(baris.id);

  audit(req, subjek, user.role, 'ALLOW', 'logout berhasil: refresh token dicabut');
  res.json({ message: 'Logout berhasil, refresh token telah dicabut' });
});

// ---------------------------------------------------------------
// POST /auth/service  (untuk Service Nilai)
// ---------------------------------------------------------------
router.post('/service', async (req, res) => {
  const { client_id, client_secret } = req.body || {};

  if (typeof client_id !== 'string' || typeof client_secret !== 'string' || !client_id || !client_secret) {
    audit(req, 'service:anonim', 'service', 'DENY', 'client_id atau client_secret tidak diisi');
    return res.status(400).json({ error: 'client_id dan client_secret wajib diisi' });
  }

  const subjek = `service:${potong(client_id)}`;
  const klien = db.prepare('SELECT * FROM service_clients WHERE client_id = ?').get(client_id);
  const secretBenar = await bcrypt.compare(client_secret, klien ? klien.secret_hash : HASH_PALSU);

  if (!klien || !secretBenar) {
    audit(req, subjek, 'service', 'DENY', klien ? 'client secret salah' : 'client_id tidak ditemukan');
    return res.status(401).json({ error: 'Kredensial service tidak valid' });
  }

  audit(req, subjek, 'service', 'ALLOW', 'token service diterbitkan: client_id dan secret valid');
  res.json({
    tokenType: 'Bearer',
    serviceToken: tokens.buatServiceToken(klien.client_id),
    expiresIn: config.token.serviceExpires,
  });
});

module.exports = router;