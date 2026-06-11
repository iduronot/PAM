const express = require('express');
const router = express.Router();
const { requireLogin, requireNotPelanggan } = require('../middleware/auth');
const { Pelanggan, Tagihan, Pembayaran, Pengaduan, PencatatanMeter, PeriodeBaca } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

router.get('/', requireLogin, requireNotPelanggan, async (req, res) => {
  try {
    const now = new Date();
    const bulanIni = now.getMonth() + 1;
    const tahunIni = now.getFullYear();

    const [
      totalPelangganAktif, totalPelangganNonaktif,
      periodeAktif,
      totalTagihanBulanIni, totalLunasBulanIni,
      pengaduanBaru, pengaduanBelumSelesai,
    ] = await Promise.all([
      Pelanggan.count({ where: { status: 'aktif' } }),
      Pelanggan.count({ where: { status: { [Op.in]: ['nonaktif', 'putus_sementara', 'putus_permanen'] } } }),
      PeriodeBaca.findOne({ where: { bulan: bulanIni, tahun: tahunIni } }),
      Tagihan.sum('total_tagihan', { where: { status: { [Op.in]: ['final', 'lunas', 'terlambat'] }, createdAt: { [Op.gte]: new Date(tahunIni, bulanIni - 1, 1) } } }),
      Tagihan.sum('total_tagihan', { where: { status: 'lunas', createdAt: { [Op.gte]: new Date(tahunIni, bulanIni - 1, 1) } } }),
      Pengaduan.count({ where: { status: 'baru' } }),
      Pengaduan.count({ where: { status: { [Op.notIn]: ['selesai', 'ditolak', 'dibatalkan'] } } }),
    ]);

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

    // Tagihan 6 bulan terakhir (untuk chart)
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(tahunIni, bulanIni - 1 - i, 1);
      const bln = d.getMonth() + 1;
      const thn = d.getFullYear();
      const total = await Tagihan.sum('total_tagihan', {
        where: {
          status: { [Op.in]: ['final', 'lunas', 'terlambat'] },
          createdAt: { [Op.gte]: new Date(thn, bln - 1, 1), [Op.lt]: new Date(thn, bln, 1) }
        }
      }) || 0;
      const lunas = await Tagihan.sum('total_tagihan', {
        where: {
          status: 'lunas',
          createdAt: { [Op.gte]: new Date(thn, bln - 1, 1), [Op.lt]: new Date(thn, bln, 1) }
        }
      }) || 0;
      const namaBln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][bln - 1];
      chartData.push({ label: `${namaBln} ${thn}`, total, lunas });
    }

    res.render('dashboard/index', {
      currentPage: 'dashboard',
      totalPelangganAktif, totalPelangganNonaktif,
      totalTagihanBulanIni: totalTagihanBulanIni || 0,
      totalLunasBulanIni: totalLunasBulanIni || 0,
      totalTunggakan: totalTunggakan || 0,
      pelangganMenunggak,
      pengaduanBaru, pengaduanBelumSelesai,
      progressBaca, periodeAktif,
      chartData: JSON.stringify(chartData),
      bulanIni, tahunIni,
    });
  } catch (e) {
    console.error(e);
    req.flash('error', 'Gagal memuat dashboard');
    res.redirect('/');
  }
});

module.exports = router;
