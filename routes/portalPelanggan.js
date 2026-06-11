const express = require('express');
const router = express.Router();
const { requireLogin, requireRole } = require('../middleware/auth');
const { Pelanggan, Tagihan, Pembayaran, Pengaduan, PeriodeBaca, Meter } = require('../models');
const { generateNomorTiket } = require('../helpers/format');
const { Op } = require('sequelize');

router.use(requireLogin, requireRole('pelanggan'));

router.get('/', async (req, res) => {
  const pelangkan = await Pelanggan.findByPk(req.session.user.pelanggan_id, {
    include: [{ model: Meter, as: 'meter' }],
  });
  if (!pelangkan) return res.render('portal/error', { message: 'Data pelanggan tidak ditemukan', currentPage: 'portal' });

  const tagihanTerbuka = await Tagihan.findAll({
    where: { pelanggan_id: pelangkan.id, status: { [Op.in]: ['final', 'terlambat'] } },
    order: [['createdAt', 'DESC']], limit: 3,
  });

  const pembayaranTerakhir = await Pembayaran.findAll({
    where: { pelanggan_id: pelangkan.id },
    include: [{ model: Tagihan, as: 'tagihan' }],
    order: [['tanggal_bayar', 'DESC']], limit: 5,
  });

  const pengaduanAktif = await Pengaduan.findAll({
    where: { pelanggan_id: pelangkan.id, status: { [Op.notIn]: ['selesai', 'dibatalkan', 'ditolak'] } },
    order: [['createdAt', 'DESC']],
  });

  res.render('portal/dashboard', {
    currentPage: 'portal', pelangkan,
    tagihanTerbuka, pembayaranTerakhir, pengaduanAktif,
  });
});

router.get('/tagihan', async (req, res) => {
  const tagihanList = await Tagihan.findAll({
    where: { pelanggan_id: req.session.user.pelanggan_id },
    include: [{ model: PeriodeBaca, as: 'periode' }],
    order: [['createdAt', 'DESC']],
  });
  res.render('portal/tagihan', { currentPage: 'portal', tagihanList });
});

router.get('/riwayat-bayar', async (req, res) => {
  const pembayaranList = await Pembayaran.findAll({
    where: { pelanggan_id: req.session.user.pelanggan_id },
    include: [{ model: Tagihan, as: 'tagihan' }],
    order: [['tanggal_bayar', 'DESC']],
  });
  res.render('portal/riwayat_bayar', { currentPage: 'portal', pembayaranList });
});

router.get('/pengaduan', async (req, res) => {
  const pengaduanList = await Pengaduan.findAll({
    where: { pelanggan_id: req.session.user.pelanggan_id },
    order: [['createdAt', 'DESC']],
  });
  res.render('portal/pengaduan', { currentPage: 'portal', pengaduanList });
});

router.post('/pengaduan/buat', async (req, res) => {
  try {
    const no_tiket = generateNomorTiket();
    await Pengaduan.create({
      ...req.body,
      pelanggan_id: req.session.user.pelanggan_id,
      no_tiket,
      created_by: req.session.user.id,
    });
    req.flash('success', `Pengaduan ${no_tiket} berhasil diajukan`);
  } catch (e) {
    req.flash('error', e.message || 'Gagal membuat pengaduan');
  }
  res.redirect('/pelanggan-portal/pengaduan');
});

module.exports = router;
