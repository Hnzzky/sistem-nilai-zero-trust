const tokens = require('./tokens');

// Memeriksa tanda tangan dan masa berlaku JWT pada header Authorization.
// Jika valid, isi token tersedia di req.auth.
function wajibToken(req, res, next) {
  const [skema, token] = (req.get('Authorization') || '').split(' ');
  if (skema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token tidak ada' });
  }

  try {
    req.auth = tokens.verifikasiToken(token);
    return next();
  } catch (err) {
    const pesan = err.name === 'TokenExpiredError' ? 'Token kedaluwarsa' : 'Token tidak valid';
    return res.status(401).json({ error: pesan });
  }
}

// Membatasi endpoint ke role tertentu (diambil dari token yang sudah diverifikasi)
function wajibRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Role tidak diizinkan di service ini' });
    }
    return next();
  };
}

module.exports = { wajibToken, wajibRole };