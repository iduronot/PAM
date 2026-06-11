const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { requireLogin, requireRole } = require('../middleware/auth');
const { Pembayaran, Tagihan, Pelanggan, User } = require('../models');
const { generateNomorPembayaran } = require('../helpers/format');
const { log } = require('../helpers/audit');
const { Op } = require('sequelize');

const storage = multer.diskStorage({
  destination: 'public/uploads/bukti/',
  filename: (req, file, cb) => cb(null, `bukti_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// List pembayaran
router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'kasir', 'manajer'), async (req, res) => {
  const { q, tanggal_dari, tanggal_sampai, metode, page = 1 } = req.query;
  const limit = 25;
  const offset = (page - 1) * limit;
  const where = {};

  if (tanggal_dari && tanggal_sampai) {
    where.tanggal_bayar = { [Op.between]: [tanggal_dari, tanggal_sampai] };
  } else if (tanggal_dari) {
    where.tanggal_bayar = { [Op.gte]: tanggal_dari };
  }
  if (metode) where.metode = metode;

  const { count, rows } = await Pembayaran.findAndCountAll({
    where, limit, offset,
    include: [
      { model: Pelanggan, as: 'pelanggan' },
      { model: Tagihan, as: 'tagihan' },
      { model: User, as: 'kasir' },
    ],
    order: [['createdAt', 'DESC']],
  });

  const totalPages = Math.ceil(count / limit);
  const totalBayar = rows.reduce((s, p) => s + parseFloat(p.jumlah_bayar || 0), 0);

  res.render('pembayaran/index', {
    currentPage: 'pembayaran',
    pembayaranList: rows, count, totalPages, page: parseInt(page), limit,
    totalBayar, q, tanggal_dari, tanggal_sampai, metode,
  });
});

// Catat pembayaran - cari tagihan
router.get('/catat', requireLogin, requireRole('super_admin', 'admin_pam', 'kasir', 'petugas_meter'), async (req, res) => {
  const { q, tagihan_id } = req.query;
  let tagihanList = [];
  let tagihanDipilih = null;

  if (tagihan_id) {
    tagihanDipilih = await Tagihan.findByPk(tagihan_id, {
      include: [{ model: Pelanggan, as: 'pelanggan' }],
    });
  } else if (q) {
    const pelangganIds = await Pelanggan.findAll({
      where: { [Op.or]: [{ nama: { [Op.like]: `%${q}%` } }, { no_pelanggan: { [Op.like]: `%${q}%` } }, { no_sambungan: { [Op.like]: `%${q}%` } }, { no_hp: { [Op.like]: `%${q}%` } }] },
      attributes: ['id'],
    });
    tagihanList = await Tagihan.findAll({
      where: { pelanggan_id: { [Op.in]: pelangganIds.map(p => p.id) }, status: { [Op.in]: ['final', 'terlambat'] } },
      include: [{ model: Pelanggan, as: 'pelanggan' }],
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
  }

  res.render('pembayaran/catat', {
    currentPage: 'pembayaran', tagihanList, tagihanDipilih, q, tagihan_id,
  });
});

// Simpan pembayaran
router.post('/catat', requireLogin, requireRole('super_admin', 'admin_pam', 'kasir', 'petugas_meter'), upload.single('bukti_pembayaran'), async (req, res) => {
  try {
    const { tagihan_id, metode, catatan } = req.body;
    const tagihan = await Tagihan.findByPk(tagihan_id, { include: [{ model: Pelanggan, as: 'pelanggan' }] });
    if (!tagihan) { req.flash('error', 'Tagihan tidak ditemukan'); return res.redirect('/pembayaran/catat'); }
    if (tagihan.status === 'lunas') { req.flash('error', 'Tagihan sudah lunas'); return res.redirect('/pembayaran/catat'); }

    const jumlah_bayar = parseFloat(tagihan.total_tagihan);
    const no_pembayaran = generateNomorPembayaran();
    const data = {
      no_pembayaran,
      tagihan_id,
      pelanggan_id: tagihan.pelanggan_id,
      tanggal_bayar: new Date().toISOString().split('T')[0],
      jumlah_bayar,
      metode: metode || 'tunai',
      kasir_id: req.session.user.id,
      catatan,
    };
    if (req.file) data.bukti_pembayaran = '/uploads/bukti/' + req.file.filename;

    const pembayaran = await Pembayaran.create(data);
    await tagihan.update({ status: 'lunas' });
    await log(req.session.user.id, 'CATAT_BAYAR', 'pembayaran', pembayaran.id, null, data, req.ip, `Bayar tagihan ${tagihan.no_tagihan}`);

    req.flash('success', `Pembayaran ${no_pembayaran} berhasil dicatat`);
    res.redirect(`/pembayaran/${pembayaran.id}/bukti`);
  } catch (e) {
    req.flash('error', e.message || 'Gagal mencatat pembayaran');
    res.redirect('/pembayaran/catat');
  }
});

// Cetak/lihat bukti
router.get('/:id/bukti', requireLogin, requireRole('super_admin', 'admin_pam', 'kasir', 'petugas_meter'), async (req, res) => {
  const pembayaran = await Pembayaran.findByPk(req.params.id, {
    include: [
      { model: Pelanggan, as: 'pelanggan' },
      { model: Tagihan, as: 'tagihan' },
      { model: User, as: 'kasir' },
    ],
  });
  if (!pembayaran) { req.flash('error', 'Data pembayaran tidak ditemukan'); return res.redirect('/pembayaran'); }
  res.render('pembayaran/bukti', { currentPage: 'pembayaran', pembayaran, APP_NAME: process.env.APP_NAME });
});

module.exports = router;
