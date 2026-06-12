const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Pembayaran, Pengeluaran, Pemasukan, Pelanggan, AppSetting } = require('../models');

// Middleware: cek apakah sudah verifikasi kode
function requirePublikAuth(req, res, next) {
  if (req.session.publik_verified) return next();
  res.redirect('/publik');
}

// GET /publik — halaman masuk kode
router.get('/', (req, res) => {
  res.render('publik/landing', { error: null, APP_NAME: process.env.APP_NAME || 'PAMSIMAS' });
});

// POST /publik — validasi kode
router.post('/', async (req, res) => {
  const setting = await AppSetting.findByPk('kode_publik');
  const kodeBenar = setting ? setting.value : 'PAM2025';
  if (req.body.kode === kodeBenar) {
    req.session.publik_verified = true;
    return res.redirect('/publik/dashboard');
  }
  res.render('publik/landing', { error: 'Kode akses salah. Silakan coba lagi.', APP_NAME: process.env.APP_NAME || 'PAMSIMAS' });
});

// GET /publik/logout
router.get('/logout', (req, res) => {
  req.session.publik_verified = false;
  res.redirect('/publik');
});

// GET /publik/dashboard — laporan keuangan publik
router.get('/dashboard', requirePublikAuth, async (req, res) => {
  const now = new Date();
  const bulan = parseInt(req.query.bulan) || now.getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || now.getFullYear();
  const awalBulan = new Date(tahun, bulan - 1, 1);
  const awalBulanDepan = new Date(tahun, bulan, 1);
  const awalBulanStr = awalBulan.toISOString().slice(0, 10);
  const awalBulanDepanStr = awalBulanDepan.toISOString().slice(0, 10);

  const NAMA_BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const LABEL_KATEGORI_PENGELUARAN = {
    operasional: 'Operasional', pemeliharaan: 'Pemeliharaan', gaji: 'Gaji/Honor',
    utilitas: 'Listrik/Air/Internet', perlengkapan: 'Perlengkapan', lain_lain: 'Lain-lain',
  };
  const LABEL_KATEGORI_PEMASUKAN = {
    hibah_desa: 'Hibah Desa', hibah_kecamatan: 'Hibah Kecamatan',
    hibah_pemerintah: 'Hibah Pemerintah', donasi: 'Donasi',
    retribusi: 'Retribusi', lain_lain: 'Lain-lain',
  };

  const [
    namaSetting, alamatSetting,
    iuranBulan, pengeluaranBulan,
    iuranTotal, pengeluaranTotal,
    hibahBulan, hibahTotal,
    totalPelangganAktif,
  ] = await Promise.all([
    AppSetting.findByPk('nama_organisasi'),
    AppSetting.findByPk('alamat_organisasi'),
    Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } } }),
    Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalBulanStr, [Op.lt]: awalBulanDepanStr } } }),
    Pembayaran.sum('jumlah_bayar'),
    Pengeluaran.sum('jumlah'),
    Pemasukan.sum('jumlah', { where: { tanggal: { [Op.gte]: awalBulanStr, [Op.lt]: awalBulanDepanStr } } }),
    Pemasukan.sum('jumlah'),
    Pelanggan.count({ where: { status: 'aktif' } }),
  ]);

  const pemasukanBulan = (iuranBulan || 0) + (hibahBulan || 0);
  const pemasukanTotal = (iuranTotal || 0) + (hibahTotal || 0);

  // Rincian pengeluaran bulan ini
  const pengeluaranDetail = await Pengeluaran.findAll({
    where: { tanggal: { [Op.gte]: awalBulanStr, [Op.lt]: awalBulanDepanStr } },
    order: [['jumlah', 'DESC']],
  });

  // Rincian pemasukan non-tagihan bulan ini
  const pemasukanDetail = await Pemasukan.findAll({
    where: { tanggal: { [Op.gte]: awalBulanStr, [Op.lt]: awalBulanDepanStr } },
    order: [['jumlah', 'DESC']],
  });

  // Chart 6 bulan
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(tahun, bulan - 1 - i, 1);
    const bln = d.getMonth() + 1;
    const thn = d.getFullYear();
    const awal = new Date(thn, bln - 1, 1);
    const akhir = new Date(thn, bln, 1);
    const awalStr = awal.toISOString().slice(0, 10);
    const akhirStr = akhir.toISOString().slice(0, 10);
    const [iuran, keluar, hibah] = await Promise.all([
      Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awal, [Op.lt]: akhir } } }),
      Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } } }),
      Pemasukan.sum('jumlah', { where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } } }),
    ]);
    chartData.push({ label: `${NAMA_BULAN[bln-1]} ${thn}`, masuk: (iuran || 0) + (hibah || 0), keluar: keluar || 0 });
  }

  res.render('publik/dashboard', {
    bulan, tahun,
    bulanNow: now.getMonth() + 1, tahunNow: now.getFullYear(),
    namaOrganisasi: namaSetting ? namaSetting.value : 'PAMSIMAS',
    alamatOrganisasi: alamatSetting ? alamatSetting.value : '',
    iuranBulan: iuranBulan || 0,
    hibahBulan: hibahBulan || 0,
    pemasukanBulan,
    pengeluaranBulan: pengeluaranBulan || 0,
    saldoBulan: pemasukanBulan - (pengeluaranBulan || 0),
    pemasukanTotal,
    pengeluaranTotal: pengeluaranTotal || 0,
    saldoTotal: pemasukanTotal - (pengeluaranTotal || 0),
    totalPelangganAktif,
    pengeluaranDetail,
    pemasukanDetail,
    chartData: JSON.stringify(chartData),
    LABEL_KATEGORI_PENGELUARAN,
    LABEL_KATEGORI_PEMASUKAN,
    APP_NAME: process.env.APP_NAME || 'PAMSIMAS',
  });
});

module.exports = router;
