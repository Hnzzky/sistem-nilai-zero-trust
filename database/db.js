const Database = require('better-sqlite3');
const config = require('../shared/config');

// Satu file database dibuka oleh gateway, service nilai, dan service transkrip
const db = new Database(config.dbPath);

// WAL membuat beberapa proses bisa membaca/menulis file yang sama dengan aman
db.pragma('journal_mode = WAL');
// Jika database sedang dikunci proses lain, tunggu hingga 5 detik sebelum error
db.pragma('busy_timeout = 5000');
// SQLite tidak menegakkan foreign key kecuali diaktifkan per koneksi
db.pragma('foreign_keys = ON');

module.exports = db;