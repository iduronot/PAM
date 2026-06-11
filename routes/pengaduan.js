const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { requireLogin, requireRole } = require('../middleware/auth');
const { Pengaduan, PengaduanLog, Pelanggan, User } = require('../models');
const { generateNomorTiket } = require('../helpers/format');
const { log } = require('../helpers/audit');
const { Op } = require('sequelize');

const storage = multer.diskStorage({
  destination: 'public/uploads/pengaduan/',
  filename: (req, file, cb) => cb(null, `pgd_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).fields([
  { name: 'foto_sebelum', maxCount: 1 },
  { name: 'foto_sesudah', maxCount: 1 },
]);

const adminRoles = ['super_admin', 'admin_pam', 'manajer'];

router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'petugas_meter', 'kasir'), async (req, res) => {
  const { status, prioritas, jenis, page = 1 } = req.query;
  const limit = 25;
  const offset = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;
  if (prioritas) where.prioritas = prioritas;
  if (jenis) where.jenis_pengaduan = jenis;

  // Petugas hanya lihat yang ditugaskan ke mereka
  if (req.session.user.role === 'petugas_meter') {
    where.petugas_id = req.session.user.id;
  }

  const { count, rows } = await Pengaduan.findAndCountAll({
    where, limit, offset,
    include: [
      { model: Pelanggan, as: 'pelanggan' },
      { model: User, as: 'petugas' },
    ],
    order: [['createdAt', 'DESC']],
  });

  res.render('pengaduan/index', {
    currentPage: 'pengaduan',
    pengaduanList: rows, count,
    totalPages: Math.ceil(count / limit), page: parseInt(page),
    status, prioritas, jenis,
  });
});

router.get('/buat', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'kasir'), async (req, res) => {
  const pelangganList = await Pelanggan.findAll({ where: { status: 'aktif' }, order: [['nama', 'ASC']] });
  res.render('pengaduan/form', { currentPage: 'pengaduan', mode: 'buat', pengaduan: {}, pelangganList });
});

router.post('/buat', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'kasir'), upload, async (req, res) => {
  try {
    const data = { ...req.body, created_by: req.session.user.id };
    if (req.files?.foto_sebelum) data.foto_sebelum = '/uploads/pengaduan/' + req.files.foto_sebelum[0].filename;
    data.no_tiket = generateNomorTiket();
    const pengaduan = await Pengaduan.create(data);
    await PengaduanLog.create({ pengaduan_id: pengaduan.id, status_lama: null, status_baru: 'baru', catatan: 'Pengaduan dibuat', user_id: req.session.user.id });
    req.flash('success', `Pengaduan ${pengaduan.no_tiket} berhasil dibuat`);
    res.redirect(`/pengaduan/${pengaduan.id}`);
  } catch (e) {
    req.flash('error', e.message || 'Gagal membuat pengaduan');
    res.redirect('/pengaduan/buat');
  }
});

router.get('/:id', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'petugas_meter', 'kasir'), async (req, res) => {
  const pengaduan = await Pengaduan.findByPk(req.params.id, {
    include: [
      { model: Pelanggan, as: 'pelanggan' },
      { model: User, as: 'petugas' },
      { model: PengaduanLog, as: 'log', include: [{ model: User, as: 'user' }] },
    ],
  });
  if (!pengaduan) { req.flash('error', 'Pengaduan tidak ditemukan'); return res.redirect('/pengaduan'); }
  const petugasList = await User.findAll({ where: { role: { [Op.in]: ['petugas_meter', 'admin_pam'] }, is_active: true }, order: [['nama', 'ASC']] });
  res.render('pengaduan/detail', { currentPage: 'pengaduan', pengaduan, petugasList });
});

// Update status
router.post('/:id/status', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'petugas_meter'), upload, async (req, res) => {
  const pengaduan = await Pengaduan.findByPk(req.params.id);
  if (!pengaduan) { req.flash('error', 'Tidak ditemukan'); return res.redirect('/pengaduan'); }

  const old_status = pengaduan.status;
  const data = { status: req.body.status };
  if (req.body.catatan_tindakan) data.catatan_tindakan = req.body.catatan_tindakan;
  if (req.body.petugas_id) data.petugas_id = req.body.petugas_id;
  if (req.body.catatan_penutup) data.catatan_penutup = req.body.catatan_penutup;
  if (req.body.status === 'selesai') data.selesai_at = new Date();
  if (req.files?.foto_sesudah) data.foto_sesudah = '/uploads/pengaduan/' + req.files.foto_sesudah[0].filename;

  await pengaduan.update(data);
  await PengaduanLog.create({ pengaduan_id: pengaduan.id, status_lama: old_status, status_baru: req.body.status, catatan: req.body.catatan_log || req.body.catatan_tindakan, user_id: req.session.user.id });
  await log(req.session.user.id, 'UPDATE_PENGADUAN', 'pengaduan', pengaduan.id, { status: old_status }, { status: req.body.status }, req.ip);

  req.flash('success', `Status pengaduan diperbarui ke: ${req.body.status.replace(/_/g, ' ')}`);
  res.redirect(`/pengaduan/${pengaduan.id}`);
});

module.exports = router;
