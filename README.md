# SISTEM NILAI ZERO TRUST

## 1. Deskripsi Project

Sistem Nilai Zero Trust merupakan aplikasi pengelolaan nilai mahasiswa yang menerapkan konsep keamanan Zero Trust. Sistem ini menggunakan mekanisme verifikasi identitas pengguna, validasi perangkat (Device ID), token autentikasi, serta pencatatan aktivitas akses untuk memastikan setiap permintaan akses diperiksa terlebih dahulu.

Aplikasi terdiri dari tiga layanan utama:
- **Gateway:** Menjadi pintu masuk permintaan dan pengelola akses.
- **Service Nilai:** Mengelola data nilai mahasiswa.
- **Service Transkrip:** Mengelola data transkrip mahasiswa.

## 2. Teknologi yang Digunakan

- Node.js
- Express.js
- SQLite
- JSON Web Token (JWT)
- Bcrypt
- HTTP Proxy Middleware

## 3. Persyaratan Sistem

Sebelum menjalankan aplikasi, pastikan perangkat sudah memiliki:

1. Node.js
2. NPM (Node Package Manager)
3. Git
4. Visual Studio Code atau terminal lainnya.

## 4. Cara Instalasi dan Menjalankan Aplikasi

### A. Clone Repository

Unduh project dari GitHub menggunakan perintah:

```bash
git clone https://github.com/Hnzzky/sistem-nilai-zero-trust.git
```

Masuk ke folder project:

```bash
cd sistem-nilai-zero-trust
```

### B. Instalasi Dependencies

Jalankan perintah:

```bash
npm install
```

Perintah tersebut digunakan untuk menginstal seluruh library dan dependencies yang dibutuhkan aplikasi.

### C. Konfigurasi Environment

Buat file `.env` pada folder utama project.

Isi konfigurasi berdasarkan contoh berikut:

```env
GATEWAY_PORT=3000
NILAI_PORT=3001
TRANSKRIP_PORT=3002

GATEWAY_URL=http://127.0.0.1:3000
NILAI_URL=http://127.0.0.1:3001
TRANSKRIP_URL=http://127.0.0.1:3002

DB_PATH=database/sistem_nilai.db

JWT_SECRET=GANTI_DENGAN_SECRET_ACAK
GATEWAY_SECRET=GANTI_DENGAN_SECRET_ACAK

ACCESS_TOKEN_EXPIRES=10m
SERVICE_TOKEN_EXPIRES=5m
REFRESH_TOKEN_DAYS=1

ACCESS_HOUR_START=7
ACCESS_HOUR_END=21
TIMEZONE=Asia/Jakarta

SERVICE_CLIENT_ID=service-nilai
SERVICE_CLIENT_SECRET=GANTI_DENGAN_SECRET_ACAK
```

**Catatan:** Ganti seluruh nilai secret dengan string acak yang kuat. Jangan menggunakan nilai contoh tersebut untuk menjalankan aplikasi.

### D. Inisialisasi Database

Untuk membuat database dan memasukkan data awal, jalankan:

```bash
npm run seed
```

Perintah ini akan membuat ulang tabel database dan memasukkan data awal berupa akun pengguna, perangkat, mata kuliah, kelas, dan nilai mahasiswa.

**Peringatan:** Perintah seed menghapus tabel lama sebelum membuat ulang database. Gunakan hanya untuk inisialisasi atau reset data praktikum, bukan ketika database sudah berisi data penting.

### E. Menjalankan Ketiga Service

Aplikasi memiliki tiga service yang harus dijalankan secara terpisah menggunakan tiga terminal.

**Terminal 1 – Gateway**

```bash
npm run start:gateway
```

Port: `3000`

**Terminal 2 – Service Nilai**

```bash
npm run start:nilai
```

Port: `3001`

**Terminal 3 – Service Transkrip**

```bash
npm run start:transkrip
```

Port: `3002`

Pastikan ketiga service berjalan tanpa error.

## 5. Daftar Akun Pengguna (Data Awal)

Berikut adalah akun demo yang tersedia setelah menjalankan proses seed database.

| No. | Username | Password | Role |
|---|---|---|---|
| 1 | admin | Admin#123 | Admin |
| 2 | dosen1 | Dosen#123 | Dosen |
| 3 | dosen2 | Dosen#123 | Dosen |
| 4 | mhs1 | Mhs#123 | Mahasiswa |
| 5 | mhs2 | Mhs#123 | Mahasiswa |
| 6 | mhs3 | Mhs#123 | Mahasiswa |

### Keterangan Role

- **Admin:** Pengguna dengan peran administrator sistem.
- **Dosen:** Pengguna yang memiliki peran sebagai dosen pengampu kelas.
- **Mahasiswa:** Pengguna yang memiliki identitas NIM dan akses terkait data akademiknya.

## 6. Daftar Device ID (Data Awal)

Setiap akun demo memiliki satu Device ID yang digunakan untuk proses verifikasi perangkat.

| No. | Username | Device ID |
|---|---|---|
| 1 | admin | ADMIN-DEVICE-001 |
| 2 | dosen1 | DOSEN-DEVICE-001 |
| 3 | dosen2 | DOSEN-DEVICE-002 |
| 4 | mhs1 | MHS-DEVICE-001 |
| 5 | mhs2 | MHS-DEVICE-002 |
| 6 | mhs3 | MHS-DEVICE-003 |

Device ID digunakan sebagai identitas perangkat yang terdaftar pada masing-masing akun.

Pada pengujian API, Device ID dikirim menggunakan header:

```http
X-Device-ID: ADMIN-DEVICE-001
```

Sesuaikan Device ID dengan akun yang sedang digunakan.

## 7. Data Awal Mata Kuliah

Database juga memiliki data awal mata kuliah berikut:

| Kode | Nama Mata Kuliah | SKS |
|---|---|---|
| IF101 | Keamanan Informasi | 3 |
| IF102 | Basis Data | 3 |

Semester: 2026/2027 Ganjil.

Dosen1 mengampu mata kuliah IF101, sedangkan Dosen2 mengampu IF102.

## 8. Pengujian Aplikasi

Beberapa perintah yang tersedia untuk membantu pengujian aplikasi:

### A. Pengujian Policy

```bash
npm run test:policy
```

Digunakan untuk menjalankan pengujian policy pada Gateway.

### B. Pengujian End-to-End

```bash
npm run test:e2e
```

Digunakan untuk menjalankan pengujian end-to-end aplikasi.

### C. Pemeriksaan Database

```bash
npm run db:cek
```

Digunakan untuk menjalankan pemeriksaan database.

### D. Audit Database

```bash
npm run db:audit
```

Digunakan untuk menjalankan pemeriksaan audit database.

### E. Membuat Koleksi Postman

```bash
npm run postman:buat
```

Digunakan untuk membuat file Postman berdasarkan script project.

## 9. Konfigurasi Keamanan

Konfigurasi keamanan aplikasi meliputi:

- Access Token dengan masa berlaku default 10 menit.
- Service Token dengan masa berlaku default 5 menit.
- Refresh Token dengan masa berlaku default 1 hari.
- Verifikasi Device ID pengguna.
- Pembatasan jam akses default pukul 07.00–21.00 WIB.
- Penyimpanan password dalam bentuk hash menggunakan Bcrypt.
- Pencatatan keputusan akses melalui tabel `audit_log`.

## 10. Struktur Database

Database menggunakan SQLite dengan tabel utama:

- users
- devices
- mata_kuliah
- kelas
- nilai
- transkrip
- refresh_tokens
- service_clients
- audit_log

## 11. Repository GitHub

Repository project:

https://github.com/Hnzzky/sistem-nilai-zero-trust

**Pemilik Repository:** Hnzzky

---

**Catatan:** Akun dan Device ID yang tercantum merupakan data demo untuk keperluan praktikum dan pengujian. Jangan menggunakan kredensial demo untuk lingkungan produksi.
