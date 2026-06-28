const express = require('express');
const router = express.Router();
const { requireLogin, requireNotPelanggan } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { Tagihan, Pembayaran, Pengeluaran, Pemasukan, Pelanggan } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const LABEL_KATEGORI_PENGELUARAN = {
  operasional: 'Operasional', pemeliharaan: 'Pemeliharaan', gaji: 'Gaji/Honor',
  utilitas: 'Listrik/Air/Internet', perlengkapan: 'Perlengkapan', lain_lain: 'Lain-lain',
};
const LABEL_KATEGORI_PEMASUKAN = {
  hibah_desa: 'Hibah Desa', hibah_kecamatan: 'Hibah Kecamatan',
  hibah_pemerintah: 'Hibah Pemerintah', donasi: 'Donasi',
  retribusi: 'Retribusi', lain_lain: 'Lain-lain',
};

const WARNA_PENGELUARAN = {
  operasional: '#0ea5e9', pemeliharaan: '#f59e0b', gaji: '#10b981',
  utilitas: '#8b5cf6', perlengkapan: '#ec4899', lain_lain: '#94a3b8',
};

router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  try {
    const now = new Date();
    const bulan = parseInt(req.query.bulan) || now.getMonth() + 1;
    const tahun = parseInt(req.query.tahun) || now.getFullYear();
    const awalBulan = new Date(tahun, bulan - 1, 1);
    const awalBulanDepan = new Date(tahun, bulan, 1);
    const awalStr = awalBulan.toISOString().slice(0, 10);
    const akhirStr = awalBulanDepan.toISOString().slice(0, 10);

    const whereLunasBulan = { status: 'lunas', createdAt: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } };
    const whereLunasAll  = { status: 'lunas' };
    const whereTagihanBulan = { status: { [Op.in]: ['final', 'lunas', 'terlambat'] }, createdAt: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } };

    const [
      // Komponen tagihan lunas bulan ini
      bebanAdminBulan, bebanMinimumBulan, subtotalAirBulan, kubikBulan,
      // Komponen tagihan lunas all-time
      bebanAdminTotal, bebanMinimumTotal, subtotalAirTotal, kubikTotal,
      // Pembayaran (iuran air diterima)
      iuranAirBulan, iuranAirTotal,
      // Pemasukan lain (hibah)
      hibahBulan, hibahTotal,
      // Pengeluaran
      pengeluaranBulanTotal, pengeluaranAllTotal,
      // Tagihan overview bulan
      totalTagihanBulan, totalLunasBulan,
      // Pelanggan
      totalPelangganAktif,
    ] = await Promise.all([
      Tagihan.sum('biaya_admin',   { where: whereLunasBulan }),
      Tagihan.sum('biaya_minimum', { where: whereLunasBulan }),
      Tagihan.sum('subtotal_air',  { where: whereLunasBulan }),
      Tagihan.sum('pemakaian',     { where: whereTagihanBulan }),
      Tagihan.sum('biaya_admin',   { where: whereLunasAll }),
      Tagihan.sum('biaya_minimum', { where: whereLunasAll }),
      Tagihan.sum('subtotal_air',  { where: whereLunasAll }),
      Tagihan.sum('pemakaian',     { where: { status: { [Op.in]: ['final', 'lunas', 'terlambat'] } } }),
      Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } } }),
      Pembayaran.sum('jumlah_bayar'),
      Pemasukan.sum('jumlah', { where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } } }),
      Pemasukan.sum('jumlah'),
      Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } } }),
      Pengeluaran.sum('jumlah'),
      Tagihan.sum('total_tagihan', { where: whereTagihanBulan }),
      Tagihan.sum('total_tagihan', { where: { status: 'lunas', createdAt: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } } }),
      Pelanggan.count({ where: { status: 'aktif' } }),
    ]);

    // Ringkasan bulan ini
    const bebanBulananBulan = (bebanAdminBulan || 0) + (bebanMinimumBulan || 0);
    const bebanBulananTotal = (bebanAdminTotal || 0) + (bebanMinimumTotal || 0);
    const totalMasukBulan   = (iuranAirBulan || 0) + (hibahBulan || 0);
    const totalMasukAll     = (iuranAirTotal || 0) + (hibahTotal || 0);
    const saldoBulan        = totalMasukBulan - (pengeluaranBulanTotal || 0);
    const saldoTotal        = totalMasukAll - (pengeluaranAllTotal || 0);

    // Pengeluaran per kategori bulan ini
    const pengeluaranPerKategori = await Pengeluaran.findAll({
      attributes: ['kategori', [sequelize.fn('SUM', sequelize.col('jumlah')), 'total'], [sequelize.fn('COUNT', sequelize.col('id')), 'jumlah_transaksi']],
      where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } },
      group: ['kategori'],
      order: [[sequelize.fn('SUM', sequelize.col('jumlah')), 'DESC']],
      raw: true,
    });

    // Detail pengeluaran bulan ini (10 teratas)
    const pengeluaranDetail = await Pengeluaran.findAll({
      where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } },
      order: [['jumlah', 'DESC']],
      limit: 15,
    });

    // Detail pemasukan lain bulan ini
    const pemasukanDetail = await Pemasukan.findAll({
      where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } },
      order: [['jumlah', 'DESC']],
    });

    // Tren 6 bulan
    const NAMA_BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const tren = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(tahun, bulan - 1 - i, 1);
      const bln = d.getMonth() + 1;
      const thn = d.getFullYear();
      const awal = new Date(thn, bln - 1, 1);
      const akhir = new Date(thn, bln, 1);
      const awalS = awal.toISOString().slice(0, 10);
      const akhirS = akhir.toISOString().slice(0, 10);
      const lWhere = { status: 'lunas', createdAt: { [Op.gte]: awal, [Op.lt]: akhir } };
      const [bAdmin, bMin, sAir, bayar, hibah, keluar] = await Promise.all([
        Tagihan.sum('biaya_admin',   { where: lWhere }),
        Tagihan.sum('biaya_minimum', { where: lWhere }),
        Tagihan.sum('subtotal_air',  { where: lWhere }),
        Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awal, [Op.lt]: akhir } } }),
        Pemasukan.sum('jumlah', { where: { tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
        Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
      ]);
      tren.push({
        label: `${NAMA_BULAN[bln - 1]} ${thn}`,
        beban: (bAdmin || 0) + (bMin || 0),
        air: sAir || 0,
        hibah: hibah || 0,
        masuk: (bayar || 0) + (hibah || 0),
        keluar: keluar || 0,
      });
    }

    res.render('keuangan/index', {
      currentPage: 'keuangan',
      bulan, tahun,
      bulanNow: now.getMonth() + 1, tahunNow: now.getFullYear(),
      // Komponen tagihan
      bebanBulananBulan, bebanBulananTotal,
      subtotalAirBulan: subtotalAirBulan || 0,
      subtotalAirTotal: subtotalAirTotal || 0,
      kubikBulan: parseFloat(kubikBulan || 0),
      kubikTotal: parseFloat(kubikTotal || 0),
      // Kas masuk
      iuranAirBulan: iuranAirBulan || 0,
      iuranAirTotal: iuranAirTotal || 0,
      hibahBulan: hibahBulan || 0,
      hibahTotal: hibahTotal || 0,
      totalMasukBulan, totalMasukAll,
      // Pengeluaran
      pengeluaranBulanTotal: pengeluaranBulanTotal || 0,
      pengeluaranAllTotal: pengeluaranAllTotal || 0,
      // Tagihan overview
      totalTagihanBulan: totalTagihanBulan || 0,
      totalLunasBulan: totalLunasBulan || 0,
      totalPelangganAktif,
      // Saldo
      saldoBulan, saldoTotal,
      // Detail
      pengeluaranPerKategori,
      pengeluaranDetail,
      pemasukanDetail,
      LABEL_KATEGORI_PENGELUARAN,
      LABEL_KATEGORI_PEMASUKAN,
      WARNA_PENGELUARAN,
      tren: JSON.stringify(tren),
    });
  } catch (e) {
    console.error(e);
    req.flash('error', 'Gagal memuat ringkasan keuangan');
    res.redirect('/dashboard');
  }
});

module.exports = router;
