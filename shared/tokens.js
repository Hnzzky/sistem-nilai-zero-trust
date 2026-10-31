const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('./config');

const ALGORITMA = 'HS256';

// Access token user: berisi sub (id user), username, role, dan tipe 'user'
function buatAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role, tipe: 'user' },
    config.jwtSecret,
    { algorithm: ALGORITMA, expiresIn: config.token.accessExpires }
  );
}

// Token service: sub = client_id, role = 'service', berlaku 5 menit
function buatServiceToken(clientId) {
  return jwt.sign(
    { sub: clientId, role: 'service', tipe: 'service' },
    config.jwtSecret,
    { algorithm: ALGORITMA, expiresIn: config.token.serviceExpires }
  );
}

// Memeriksa tanda tangan DAN masa berlaku. Melempar error jika tidak valid.
// Hanya HS256 yang diterima.
function verifikasiToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITMA] });
}

// Refresh token = string acak, bukan JWT
function buatRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

// Database hanya menyimpan hash-nya
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  buatAccessToken,
  buatServiceToken,
  verifikasiToken,
  buatRefreshToken,
  hashRefreshToken,
};