const express = require('express');
const router = express.Router();
const { requireLogin, requireNotPelanggan } = require('../middleware/auth');
const { Pelanggan, Tagihan, Pembayaran, Pengaduan, PencatatanMeter, PeriodeBaca, Pengeluaran, Pemasukan } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

router.get('/', requireLogin, requireNotPelanggan, async (req, res) => {
  try {
    const now = new Date();
    const bulanIni = parseInt(req.query.bulan) || now.getMonth() + 1;
    const tahunIni = parseInt(req.query.tahun) || now.getFullYear();

    const awalBulan = new Date(tahunIni, bulanIni - 1, 1);
    const awalBulanDepan = new Date(tahunIni, bulanIni, 1);

    const tagihanBulanWhere = { status: { [Op.in]: ['final', 'lunas', 'terlambat'] }, createdAt: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } };
    const tagihanLunasBulanWhere = { status: 'lunas', createdAt: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } };
    const tagihanLunasAllWhere  = { status: 'lunas' };

    const [
      totalPelangganAktif, totalPelangganNonaktif,
      periodeAktif,
      totalTagihanBulanIni, totalLunasBulanIni,
      pengaduanBaru, pengaduanBelumSelesai,
      pemasukanBulanIni, pengeluaranBulanIni,
      pemasukanTotal, pengeluaranTotal,
      hibahBulanIni, hibahTotal,
      // Komponen tagihan bulan ini
      kompBebanAdmin, kompBebanMinimum, kompSubtotalAir, kompKubikBulan, kompKubikTotal,
    ] = await Promise.all([
      Pelanggan.count({ where: { status: 'aktif' } }),
      Pelanggan.count({ where: { status: { [Op.in]: ['nonaktif', 'putus_sementara', 'putus_permanen'] } } }),
      PeriodeBaca.findOne({ where: { bulan: bulanIni, tahun: tahunIni } }),
      Tagihan.sum('total_tagihan', { where: tagihanBulanWhere }),
      Tagihan.sum('total_tagihan', { where: { status: 'lunas', createdAt: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } } }),
      Pengaduan.count({ where: { status: 'baru' } }),
      Pengaduan.count({ where: { status: { [Op.notIn]: ['selesai', 'ditolak', 'dibatalkan'] } } }),
      Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } } }),
      Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalBulan.toISOString().slice(0,10), [Op.lt]: awalBulanDepan.toISOString().slice(0,10) } } }),
      Pembayaran.sum('jumlah_bayar'),
      Pengeluaran.sum('jumlah'),
      Pemasukan.sum('jumlah', { where: { tanggal: { [Op.gte]: awalBulan.toISOString().slice(0,10), [Op.lt]: awalBulanDepan.toISOString().slice(0,10) } } }),
      Pemasukan.sum('jumlah'),
      Tagihan.sum('biaya_admin',   { where: tagihanLunasBulanWhere }),
      Tagihan.sum('biaya_minimum', { where: tagihanLunasBulanWhere }),
      Tagihan.sum('subtotal_air',  { where: tagihanLunasBulanWhere }),
      Tagihan.sum('pemakaian',     { where: tagihanBulanWhere }),
      Tagihan.sum('pemakaian',     { where: { status: { [Op.in]: ['final', 'lunas', 'terlambat'] } } }),
    ]);

    const bebanBulananBulanIni = (kompBebanAdmin || 0) + (kompBebanMinimum || 0);
    const pemakaianAirBulanIni = kompSubtotalAir || 0;

    const totalTunggakan = await Tagihan.sum('total_tagihan', {
      where: { status: { [Op.in]: ['final', 'terlambat'] } }
    });

    const pelangganMenunggak = await Tagihan.count({
      where: { status: { [Op.in]: ['final', 'terlambat'] } },
      col: 'pelanggan_id',
      distinct: true,
    });

    // Progress baca meter bulan ini
    let progressBaca = { total: 0, terbaca: 0, belum: 0 };
    if (periodeAktif) {
      const totalBaca = await PencatatanMeter.count({ where: { periode_id: periodeAktif.id } });
      const sudahBaca = await PencatatanMeter.count({ where: { periode_id: periodeAktif.id, status: { [Op.ne]: 'belum_dibaca' } } });
      progressBaca = { total: totalBaca, terbaca: sudahBaca, belum: totalBaca - sudahBaca };
    }

    // Tagihan 6 bulan terakhir dari bulan yang dipilih (untuk chart)
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(tahunIni, bulanIni - 1 - i, 1);
      const bln = d.getMonth() + 1;
      const thn = d.getFullYear();
      const awal = new Date(thn, bln - 1, 1);
      const akhir = new Date(thn, bln, 1);
      const awalStr = awal.toISOString().slice(0, 10);
      const akhirStr = akhir.toISOString().slice(0, 10);
      const [total, lunas, keluar, hibah, kubik] = await Promise.all([
        Tagihan.sum('total_tagihan', { where: { status: { [Op.in]: ['final', 'lunas', 'terlambat'] }, createdAt: { [Op.gte]: awal, [Op.lt]: akhir } } }),
        Tagihan.sum('total_tagihan', { where: { status: 'lunas', createdAt: { [Op.gte]: awal, [Op.lt]: akhir } } }),
        Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } } }),
        Pemasukan.sum('jumlah', { where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } } }),
        Tagihan.sum('pemakaian', { where: { status: { [Op.in]: ['final', 'lunas', 'terlambat'] }, createdAt: { [Op.gte]: awal, [Op.lt]: akhir } } }),
      ]);
      const namaBln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][bln - 1];
      chartData.push({ label: `${namaBln} ${thn}`, total: total || 0, lunas: (lunas || 0) + (hibah || 0), keluar: keluar || 0, kubik: parseFloat(kubik || 0) });
    }

    const totalPemasukanBulanIni = (pemasukanBulanIni || 0) + (hibahBulanIni || 0);
    const totalPemasukanTotal = (pemasukanTotal || 0) + (hibahTotal || 0);
    const saldoTotal = totalPemasukanTotal - (pengeluaranTotal || 0);
    const saldoBulanIni = totalPemasukanBulanIni - (pengeluaranBulanIni || 0);

    res.render('dashboard/index', {
      currentPage: 'dashboard',
      totalPelangganAktif, totalPelangganNonaktif,
      totalTagihanBulanIni: totalTagihanBulanIni || 0,
      totalLunasBulanIni: totalLunasBulanIni || 0,
      totalTunggakan: totalTunggakan || 0,
      pelangganMenunggak,
      pengaduanBaru, pengaduanBelumSelesai,
      // Komponen tagihan pelanggan bulan ini
      bebanBulananBulanIni,
      pemakaianAirBulanIni,
      kubikBulanIni: parseFloat(kompKubikBulan || 0),
      kubikTotal: parseFloat(kompKubikTotal || 0),
      // Kas masuk (Pembayaran dari pelanggan)
      iuranAirBulan: pemasukanBulanIni || 0,
      iuranAirTotal: pemasukanTotal || 0,
      // Pemasukan lain (hibah / donasi)
      hibahBulanIni: hibahBulanIni || 0,
      hibahTotal: hibahTotal || 0,
      // Beban operasional (pengeluaran)
      bebanBulan: pengeluaranBulanIni || 0,
      bebanTotal: pengeluaranTotal || 0,
      // Gabungan & saldo
      pemasukanBulanIni: totalPemasukanBulanIni,
      pengeluaranBulanIni: pengeluaranBulanIni || 0,
      saldoBulanIni,
      pemasukanTotal: totalPemasukanTotal,
      pengeluaranTotal: pengeluaranTotal || 0,
      saldoTotal,
      progressBaca, periodeAktif,
      chartData: JSON.stringify(chartData),
      bulanFilter: bulanIni, tahunFilter: tahunIni,
      bulanIni: now.getMonth() + 1, tahunIni: now.getFullYear(),
    });
  } catch (e) {
    console.error(e);
    req.flash('error', 'Gagal memuat dashboard');
    res.redirect('/');
  }
});

module.exports = router;
