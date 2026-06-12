# PAMSIMAS — Sistem Manajemen Air Minum

Aplikasi manajemen PAM (Perusahaan Air Minum) berbasis web untuk mengelola pelanggan, pencatatan meter, tagihan, pembayaran, dan pelaporan keuangan transparan.

## Teknologi

- **Backend:** Node.js + Express.js
- **Templating:** EJS
- **Database:** MySQL + Sequelize ORM
- **Autentikasi:** Session-based + bcryptjs

## Fitur

- **RBAC 6 Role** — super_admin, admin_pam, petugas_meter, kasir, manajer, pelanggan
- **Manajemen Pelanggan** — data pelanggan, kategori, rute pembacaan
- **Baca Meter** — pencatatan per periode, verifikasi, foto meter, pencarian nama pelanggan
- **Tagihan** — generate otomatis dari hasil baca meter, tarif flat rate per m³
- **Pembayaran** — catat pembayaran tunai/transfer, cetak bukti
- **Alur Lapangan** — petugas catat meter → langsung bayar di tempat
- **Pengaduan** — tracking tiket pengaduan pelanggan
- **Pemasukan Lain** — catat hibah/donasi dari desa, kecamatan, pemerintah, dll.
- **Pengeluaran** — catat pengeluaran operasional per kategori
- **Laporan** — tunggakan, pembayaran, pelanggan, tagihan (export Excel)
- **Dashboard Publik** — transparansi keuangan dengan kode akses, mencakup iuran air + hibah/donasi
- **Portal Pelanggan** — cek tagihan & riwayat bayar mandiri
- **Ganti Password Mandiri** — semua akun bisa ubah password sendiri
- **Audit Log** — semua aksi tercatat

## Instalasi

### Prasyarat

- Node.js v18+
- MySQL 5.7+ / MariaDB
- WAMP / XAMPP (opsional)

### Langkah

**1. Clone repository**
```bash
git clone https://github.com/iduronot/PAM.git
cd PAM
```

**2. Install dependensi**
```bash
npm install
```

**3. Konfigurasi environment**

Buat file `.env` di root project:
```env
PORT=3001
SESSION_SECRET=pamsimas_secret_2025

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=pamsimas

APP_NAME=PAMSIMAS
```

**4. Buat database**

Jalankan di phpMyAdmin atau MySQL CLI:
```sql
CREATE DATABASE IF NOT EXISTS pamsimas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**5. Jalankan seeder**
```bash
npm run seed
```

**6. Jalankan aplikasi**
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Akses di: **http://localhost:3001**

## Akun Default

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | super_admin |

> Ganti password setelah login pertama di menu Pengaturan → Profil.

## Struktur Direktori

```
pamsimas/
├── config/          # Konfigurasi database
├── helpers/         # Format angka, audit log
├── middleware/       # Auth, role guard
├── models/          # Sequelize models
├── routes/          # Express routes
├── seeders/         # Data awal
├── views/           # EJS templates
│   ├── partials/    # Header, sidebar, topbar
│   ├── baca_meter/
│   ├── pelanggan/
│   ├── tagihan/
│   ├── pembayaran/
│   ├── pengaduan/
│   ├── pemasukan/
│   ├── pengeluaran/
│   ├── laporan/
│   ├── publik/
│   └── portal/
├── public/          # CSS, JS, upload foto
├── .env             # Konfigurasi (tidak di-commit)
└── server.js        # Entry point
```

## Alur Kerja

### Alur Normal (Bulanan)

```
1. Buat Periode Baca  →  otomatis siapkan form untuk semua pelanggan aktif
2. Input Baca Meter   →  petugas input angka meter per pelanggan
3. Verifikasi         →  admin verifikasi hasil bacaan
4. Generate Tagihan   →  tagihan otomatis terbuat (final, siap bayar)
5. Catat Pembayaran   →  kasir/petugas catat pembayaran
6. Cetak Bukti        →  bukti pembayaran untuk pelanggan
```

### Alur Petugas Lapangan (Catat + Bayar di Tempat)

```
Input Baca Meter  →  klik "Simpan & Langsung Bayar"
  → tagihan otomatis dibuat
  → redirect ke form pembayaran
  → simpan & cetak bukti
```

## Dashboard Publik

Akses di `/publik` menggunakan kode yang dapat diatur di menu Pengaturan.
Menampilkan laporan keuangan transparan: pemasukan iuran air + hibah/donasi,
pengeluaran per kategori, tren 6 bulan, dan saldo keseluruhan organisasi.

---

Dikembangkan penuh semangat oleh **Idur Onotrah** — support by gudangtechno, gigaboot & amanna

## Lisensi

MIT
