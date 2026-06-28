require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const morgan = require('morgan');
const path = require('path');
const { sequelize } = require('./models');
const { formatRupiah, formatTanggal, namaBulan } = require('./helpers/format');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'pamsimas2025',
  resave: true,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }, // 8 jam
}));
app.use(flash());

// Global locals
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.formatRupiah = formatRupiah;
  res.locals.formatTanggal = formatTanggal;
  res.locals.namaBulan = namaBulan;
  res.locals.APP_NAME = process.env.APP_NAME || 'PAMSIMAS';
  next();
});

// Routes
app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/pelanggan', require('./routes/pelanggan'));
app.use('/meter', require('./routes/meter'));
app.use('/baca-meter', require('./routes/bacaMeter'));
app.use('/tarif', require('./routes/tarif'));
app.use('/tagihan', require('./routes/tagihan'));
app.use('/pembayaran', require('./routes/pembayaran'));
app.use('/pengaduan', require('./routes/pengaduan'));
app.use('/pengeluaran', require('./routes/pengeluaran'));
app.use('/pemasukan', require('./routes/pemasukan'));
app.use('/keuangan', require('./routes/keuangan'));
app.use('/laporan', require('./routes/laporan'));
app.use('/pengaturan', require('./routes/pengaturan'));
app.use('/akun', require('./routes/akun'));
app.use('/pelanggan-portal', require('./routes/portalPelanggan'));
app.use('/publik', require('./routes/publik'));

app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role === 'pelanggan') return res.redirect('/pelanggan-portal');
  res.redirect('/dashboard');
});

app.use((req, res) => {
  res.status(404).render('error', { message: 'Halaman tidak ditemukan', currentPage: '' });
});

const PORT = process.env.PORT || 3001;

const { AppSetting } = require('./models');

sequelize.sync({ alter: false }).then(async () => {
  console.log('Database tersinkronisasi');
  // Seed default app settings jika belum ada
  await AppSetting.bulkCreate([
    { key: 'kode_publik', value: 'PAM2025', label: 'Kode Akses Dashboard Publik' },
    { key: 'nama_organisasi', value: 'PAMSIMAS', label: 'Nama Organisasi' },
    { key: 'alamat_organisasi', value: '', label: 'Alamat Organisasi' },
  ], { ignoreDuplicates: true });
  app.listen(PORT, () => console.log(`PAMSIMAS berjalan di http://localhost:${PORT}`));
}).catch(err => {
  console.error('Gagal koneksi database:', err.message);
  process.exit(1);
});
