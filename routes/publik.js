const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Pembayaran, Pengeluaran, Pelanggan, AppSetting } = require('../models');

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

  const [
    namaSetting, alamatSetting,
    pemasukanBulan, pengeluaranBulan,
    pemasukanTotal, pengeluaranTotal,
    totalPelangganAktif,
  ] = await Promise.all([
    AppSetting.findByPk('nama_organisasi'),
    AppSetting.findByPk('alamat_organisasi'),
    Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } } }),
    Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalBulanStr, [Op.lt]: awalBulanDepanStr } } }),
    Pembayaran.sum('jumlah_bayar'),
    Pengeluaran.sum('jumlah'),
    Pelanggan.count({ where: { status: 'aktif' } }),
  ]);

  // Rincian pengeluaran bulan ini per kategori
  const pengeluaranDetail = await Pengeluaran.findAll({
    where: { tanggal: { [Op.gte]: awalBulanStr, [Op.lt]: awalBulanDepanStr } },
    order: [['jumlah', 'DESC']],
  });

  // Chart 6 bulan
  const NAMA_BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const LABEL_KATEGORI = {
    operasional: 'Operasional', pemeliharaan: 'Pemeliharaan', gaji: 'Gaji/Honor',
    utilitas: 'Listrik/Air/Internet', perlengkapan: 'Perlengkapan', lain_lain: 'Lain-lain',
  };
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(tahun, bulan - 1 - i, 1);
    const bln = d.getMonth() + 1;
    const thn = d.getFullYear();
    const awal = new Date(thn, bln - 1, 1);
    const akhir = new Date(thn, bln, 1);
    const [masuk, keluar] = await Promise.all([
      Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awal, [Op.lt]: akhir } } }),
      Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awal.toISOString().slice(0,10), [Op.lt]: akhir.toISOString().slice(0,10) } } }),
    ]);
    chartData.push({ label: `${NAMA_BULAN[bln-1]} ${thn}`, masuk: masuk || 0, keluar: keluar || 0 });
  }

  res.render('publik/dashboard', {
    bulan, tahun,
    bulanNow: now.getMonth() + 1, tahunNow: now.getFullYear(),
    namaOrganisasi: namaSetting ? namaSetting.value : 'PAMSIMAS',
    alamatOrganisasi: alamatSetting ? alamatSetting.value : '',
    pemasukanBulan: pemasukanBulan || 0,
    pengeluaranBulan: pengeluaranBulan || 0,
    saldoBulan: (pemasukanBulan || 0) - (pengeluaranBulan || 0),
    pemasukanTotal: pemasukanTotal || 0,
    pengeluaranTotal: pengeluaranTotal || 0,
    saldoTotal: (pemasukanTotal || 0) - (pengeluaranTotal || 0),
    totalPelangganAktif,
    pengeluaranDetail,
    chartData: JSON.stringify(chartData),
    LABEL_KATEGORI,
    APP_NAME: process.env.APP_NAME || 'PAMSIMAS',
  });
});

module.exports = router;
