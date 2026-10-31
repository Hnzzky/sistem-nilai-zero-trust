-- Akun pengguna. nim hanya terisi untuk mahasiswa.
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('mahasiswa', 'dosen', 'admin')),
  nama          TEXT NOT NULL,
  nim           TEXT UNIQUE
);

-- Device terdaftar milik user (1 device per user pada data awal).
CREATE TABLE devices (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE
);

CREATE TABLE mata_kuliah (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  sks  INTEGER NOT NULL
);

-- Kelas diampu oleh satu dosen (dosen_id). Dipakai Policy Engine untuk cek kepemilikan.
CREATE TABLE kelas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  mata_kuliah_id INTEGER NOT NULL REFERENCES mata_kuliah(id),
  dosen_id       INTEGER NOT NULL REFERENCES users(id),
  nama_kelas     TEXT NOT NULL,
  semester       TEXT NOT NULL
);

-- Nilai satu mahasiswa pada satu kelas. status 'final' mengunci perubahan.
CREATE TABLE nilai (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kelas_id     INTEGER NOT NULL REFERENCES kelas(id),
  mahasiswa_id INTEGER NOT NULL REFERENCES users(id),
  nilai_angka  REAL NOT NULL CHECK (nilai_angka >= 0 AND nilai_angka <= 100),
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  UNIQUE (kelas_id, mahasiswa_id)
);

-- Transkrip diisi oleh endpoint sinkron setelah finalisasi.
CREATE TABLE transkrip (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nim         TEXT NOT NULL,
  kode_mk     TEXT NOT NULL,
  nama_mk     TEXT NOT NULL,
  sks         INTEGER NOT NULL,
  nilai_angka REAL NOT NULL,
  nilai_huruf TEXT NOT NULL,
  kelas_id    INTEGER NOT NULL,
  synced_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (nim, kelas_id)
);

-- Refresh token disimpan dalam bentuk hash, bukan teks asli.
CREATE TABLE refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_id  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0
);

-- Kredensial service untuk POST /auth/service.
CREATE TABLE service_clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  nama        TEXT NOT NULL
);

-- Jejak setiap keputusan akses (ditulis gateway).
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subjek     TEXT NOT NULL,
  role       TEXT,
  metode     TEXT,
  endpoint   TEXT NOT NULL,
  device_id  TEXT,
  keputusan  TEXT NOT NULL CHECK (keputusan IN ('ALLOW', 'DENY')),
  alasan     TEXT NOT NULL
);