const db = require('../../database/db');
const tokens = require('../../shared/tokens');
const policy = require('../policy');
const { catat } = require('../auditLog');

const cariUser = db.prepare('SELECT id, username, role, nim FROM users WHERE id = ?');
const cekDevice = db.prepare('SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?');

// Mencatat DENY ke audit log lalu membalas client
function tolak(req, res, { status, subjek, role = null, deviceId = null, alasan }) {
  catat({
    subjek,
    role,
    metode: req.method,
    endpoint: req.originalUrl.split('?')[0],
    deviceId,
    keputusan: 'DENY',
    alasan,
  });
  return res.status(status).json({ error: 'Akses ditolak', alasan });
}

// PEP: dijalankan untuk SETIAP request ke /nilai, /kelas, /transkrip
function enforce(req, res, next) {
  const deviceId = (req.get('X-Device-ID') || '').trim() || null;

  // --- Langkah 1: ada bearer token? ---
  const [skema, token] = (req.get('Authorization') || '').split(' ');
  if (skema !== 'Bearer' || !token) {
    return tolak(req, res, { status: 401, subjek: 'anonim', deviceId, alasan: 'token tidak ada' });
  }

  // --- Langkah 2: tanda tangan dan masa berlaku ---
  let payload;
  try {
    payload = tokens.verifikasiToken(token);
  } catch (err) {
    const alasan =
      err.name === 'TokenExpiredError'
        ? 'token kedaluwarsa'
        : 'token tidak valid (tanda tangan atau format salah)';
    return tolak(req, res, { status: 401, subjek: 'anonim', deviceId, alasan });
  }

  // --- Langkah 3: identifikasi subjek ---
  let subject;

  if (payload.tipe === 'service') {
    if (payload.role !== 'service') {
      return tolak(req, res, { status: 401, subjek: 'anonim', deviceId, alasan: 'token service tidak konsisten' });
    }
    subject = { tipe: 'service', id: payload.sub, role: 'service', label: `service:${payload.sub}` };
  } else if (payload.tipe === 'user') {
    const idUser = Number(payload.sub);
    const user = Number.isInteger(idUser) ? cariUser.get(idUser) : undefined;

    if (!user) {
      return tolak(req, res, { status: 401, subjek: 'anonim', deviceId, alasan: 'user pada token tidak ada di database' });
    }

    const label = `user:${user.username}`;

    if (user.role !== payload.role) {
      return tolak(req, res, { status: 401, subjek: label, role: user.role, deviceId, alasan: 'role pada token tidak sesuai database' });
    }

    // Verifikasi konteks: setiap request user wajib membawa device terdaftar
    if (!deviceId) {
      return tolak(req, res, { status: 403, subjek: label, role: user.role, deviceId, alasan: 'header X-Device-ID tidak ada' });
    }
    if (!cekDevice.get(user.id, deviceId)) {
      return tolak(req, res, { status: 403, subjek: label, role: user.role, deviceId, alasan: 'device tidak terdaftar untuk user ini' });
    }

    subject = { tipe: 'user', id: user.id, username: user.username, role: user.role, nim: user.nim, label };
  } else {
    return tolak(req, res, { status: 401, subjek: 'anonim', deviceId, alasan: 'tipe token tidak dikenal' });
  }

  // --- Langkah 4: minta keputusan ke Policy Engine ---
  const keputusan = policy.evaluate({
    subject,
    method: req.method,
    path: req.path,
    query: req.query,
  });

  if (!keputusan.allow) {
    return tolak(req, res, {
      status: keputusan.status,
      subjek: subject.label,
      role: subject.role,
      deviceId,
      alasan: keputusan.reason,
    });
  }

  // --- Langkah 5: catat ALLOW, lalu lanjut ke proxy ---
  catat({
    subjek: subject.label,
    role: subject.role,
    metode: req.method,
    endpoint: req.originalUrl.split('?')[0],
    deviceId,
    keputusan: 'ALLOW',
    alasan: keputusan.reason,
  });

  req.subject = subject;
  next();
}

module.exports = enforce;