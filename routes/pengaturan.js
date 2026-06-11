const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireLogin, requireRole } = require('../middleware/auth');
const { User, KategoriPelanggan, Rute, AuditLog, Pelanggan } = require('../models');
const { log } = require('../helpers/audit');

// Halaman pengaturan utama - hanya super_admin & admin_pam
router.get('/', requireLogin, requireRole('super_admin', 'admin_pam'), (req, res) => {
  res.render('pengaturan/index', { currentPage: 'pengaturan' });
});

// ─── Manajemen User ───────────────────────────────────────────────────────────
router.get('/users', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const userList = await User.findAll({ order: [['nama', 'ASC']] });
  res.render('pengaturan/users', { currentPage: 'pengaturan', userList });
});

router.get('/users/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const pelangganList = await Pelanggan.findAll({ where: { status: 'aktif' }, order: [['nama', 'ASC']] });
  res.render('pengaturan/user_form', { currentPage: 'pengaturan', mode: 'tambah', userEdit: {}, pelangganList });
});

router.post('/users/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const { nama, username, email, password, role, pelanggan_id } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ nama, username, email, password: hash, role, pelanggan_id: pelanggan_id || null });
    await log(req.session.user.id, 'CREATE_USER', 'users', user.id, null, { nama, username, role }, req.ip);
    req.flash('success', `User ${nama} berhasil ditambahkan`);
    res.redirect('/pengaturan/users');
  } catch (e) {
    req.flash('error', e.message || 'Gagal menambahkan user');
    res.redirect('/pengaturan/users/tambah');
  }
});

router.get('/users/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const userEdit = await User.findByPk(req.params.id);
  if (!userEdit) { req.flash('error', 'User tidak ditemukan'); return res.redirect('/pengaturan/users'); }
  const pelangganList = await Pelanggan.findAll({ order: [['nama', 'ASC']] });
  res.render('pengaturan/user_form', { currentPage: 'pengaturan', mode: 'edit', userEdit, pelangganList });
});

router.post('/users/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const userEdit = await User.findByPk(req.params.id);
    if (!userEdit) { req.flash('error', 'User tidak ditemukan'); return res.redirect('/pengaturan/users'); }
    const { nama, email, role, is_active, pelanggan_id, password } = req.body;
    const data = { nama, email, role, is_active: is_active === '1', pelanggan_id: pelanggan_id || null };
    if (password && password.length >= 6) data.password = await bcrypt.hash(password, 10);
    await userEdit.update(data);
    await log(req.session.user.id, 'UPDATE_USER', 'users', userEdit.id, null, { nama, role }, req.ip);
    req.flash('success', 'User berhasil diperbarui');
    res.redirect('/pengaturan/users');
  } catch (e) {
    req.flash('error', e.message || 'Gagal memperbarui user');
    res.redirect(`/pengaturan/users/${req.params.id}/edit`);
  }
});

// ─── Kategori Pelanggan ───────────────────────────────────────────────────────
router.get('/kategori', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const kategoriList = await KategoriPelanggan.findAll({ order: [['nama', 'ASC']] });
  res.render('pengaturan/kategori', { currentPage: 'pengaturan', kategoriList });
});

router.post('/kategori/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  await KategoriPelanggan.create(req.body);
  req.flash('success', 'Kategori berhasil ditambahkan');
  res.redirect('/pengaturan/kategori');
});

router.post('/kategori/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  await KategoriPelanggan.update(req.body, { where: { id: req.params.id } });
  req.flash('success', 'Kategori diperbarui');
  res.redirect('/pengaturan/kategori');
});

router.post('/kategori/:id/hapus', requireLogin, requireRole('super_admin'), async (req, res) => {
  await KategoriPelanggan.destroy({ where: { id: req.params.id } });
  req.flash('success', 'Kategori dihapus');
  res.redirect('/pengaturan/kategori');
});

// ─── Rute ────────────────────────────────────────────────────────────────────
router.get('/rute', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const ruteList = await Rute.findAll({ order: [['urutan', 'ASC']] });
  res.render('pengaturan/rute', { currentPage: 'pengaturan', ruteList });
});

router.post('/rute/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  await Rute.create(req.body);
  req.flash('success', 'Rute berhasil ditambahkan');
  res.redirect('/pengaturan/rute');
});

router.post('/rute/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  await Rute.update(req.body, { where: { id: req.params.id } });
  req.flash('success', 'Rute diperbarui');
  res.redirect('/pengaturan/rute');
});

router.post('/rute/:id/hapus', requireLogin, requireRole('super_admin'), async (req, res) => {
  await Rute.destroy({ where: { id: req.params.id } });
  req.flash('success', 'Rute dihapus');
  res.redirect('/pengaturan/rute');
});

// ─── Audit Log ───────────────────────────────────────────────────────────────
router.get('/audit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const logList = await AuditLog.findAll({
    include: [{ model: User, as: 'user' }],
    order: [['createdAt', 'DESC']],
    limit: 200,
  });
  res.render('pengaturan/audit', { currentPage: 'pengaturan', logList });
});

module.exports = router;
