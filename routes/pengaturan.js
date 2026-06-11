const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireLogin, requireRole } = require('../middleware/auth');
const { User, KategoriPelanggan, Rute, AuditLog, Pelanggan, AppSetting } = require('../models');
const { log } = require('../helpers/audit');
const { Op } = require('sequelize');

// Halaman pengaturan utama - hanya super_admin & admin_pam
router.get('/', requireLogin, requireRole('super_admin', 'admin_pam'), (req, res) => {
  res.render('pengaturan/index', { currentPage: 'pengaturan' });
});

// ─── Manajemen User ───────────────────────────────────────────────────────────
router.get('/users', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const { q, role, is_active, page = 1 } = req.query;
  const limit = 20;
  const offset = (parseInt(page) - 1) * limit;
  const where = {};
  if (q) where[Op.or] = [{ nama: { [Op.like]: `%${q}%` } }, { username: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }];
  if (role) where.role = role;
  if (is_active !== undefined && is_active !== '') where.is_active = is_active === '1';
  const { count, rows } = await User.findAndCountAll({ where, order: [['nama', 'ASC']], limit, offset });
  res.render('pengaturan/users', { currentPage: 'pengaturan', userList: rows, count, totalPages: Math.ceil(count / limit), page: parseInt(page), limit, q, role, is_active });
});

router.get('/users/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const pelangganList = await Pelanggan.findAll({ where: { status: 'aktif' }, order: [['nama', 'ASC']] });
  res.render('pengaturan/user_form', { currentPage: 'pengaturan', mode: 'tambah', userEdit: {}, pelangganList });
});

router.post('/users/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const { nama, username, email, password, role, pelanggan_id } = req.body;
    if (!nama || !nama.trim()) { req.flash('error', 'Nama lengkap wajib diisi'); return res.redirect('/pengaturan/users/tambah'); }
    if (!username || !username.trim()) { req.flash('error', 'Username wajib diisi'); return res.redirect('/pengaturan/users/tambah'); }
    if (!password) { req.flash('error', 'Password wajib diisi'); return res.redirect('/pengaturan/users/tambah'); }
    const exist = await User.findOne({ where: { username: username.trim() } });
    if (exist) { req.flash('error', `Username "${username}" sudah digunakan`); return res.redirect('/pengaturan/users/tambah'); }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ nama: nama.trim(), username: username.trim(), email: email && email.trim() ? email.trim() : null, password: hash, role, pelanggan_id: pelanggan_id || null });
    await log(req.session.user.id, 'CREATE_USER', 'users', user.id, null, { nama, username, role }, req.ip);
    req.flash('success', `User ${nama.trim()} berhasil ditambahkan`);
    res.redirect('/pengaturan/users');
  } catch (e) {
    console.error('[POST /users/tambah]', e.message);
    const msg = e.name === 'SequelizeUniqueConstraintError' ? 'Username atau email sudah digunakan' : (e.message || 'Gagal menambahkan user');
    req.flash('error', msg);
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
    const data = { nama, email: email && email.trim() ? email.trim() : null, role, is_active: is_active === '1', pelanggan_id: pelanggan_id || null };
    if (password && password.trim()) data.password = await bcrypt.hash(password, 10);
    await userEdit.update(data);
    await log(req.session.user.id, 'UPDATE_USER', 'users', userEdit.id, null, { nama, role }, req.ip);
    req.flash('success', 'User berhasil diperbarui');
    res.redirect('/pengaturan/users');
  } catch (e) {
    req.flash('error', e.message || 'Gagal memperbarui user');
    res.redirect(`/pengaturan/users/${req.params.id}/edit`);
  }
});

router.post('/users/:id/ganti-password', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const { password_baru, password_konfirm } = req.body;
    if (!password_baru) { req.flash('error', 'Password baru wajib diisi'); return res.redirect('/pengaturan/users'); }
    if (password_baru !== password_konfirm) { req.flash('error', 'Konfirmasi password tidak cocok'); return res.redirect('/pengaturan/users'); }
    const userEdit = await User.findByPk(req.params.id);
    if (!userEdit) { req.flash('error', 'User tidak ditemukan'); return res.redirect('/pengaturan/users'); }
    const hash = await bcrypt.hash(password_baru, 10);
    await userEdit.update({ password: hash });
    await log(req.session.user.id, 'UPDATE_PASSWORD', 'users', userEdit.id, null, { username: userEdit.username }, req.ip);
    req.flash('success', `Password ${userEdit.nama} berhasil diubah`);
    res.redirect('/pengaturan/users');
  } catch (e) {
    console.error('[POST /users/:id/ganti-password]', e.message);
    req.flash('error', 'Gagal mengubah password');
    res.redirect('/pengaturan/users');
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

// ─── Transparansi Publik ─────────────────────────────────────────────────────
router.get('/publik', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const settings = await AppSetting.findAll({ where: { key: ['kode_publik', 'nama_organisasi', 'alamat_organisasi'] } });
  const s = {};
  settings.forEach(x => { s[x.key] = x.value; });
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.render('pengaturan/publik', { currentPage: 'pengaturan', s, baseUrl });
});

router.post('/publik', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const { kode_publik, nama_organisasi, alamat_organisasi } = req.body;
  await Promise.all([
    AppSetting.upsert({ key: 'kode_publik', value: kode_publik || 'PAM2025', label: 'Kode Akses Dashboard Publik' }),
    AppSetting.upsert({ key: 'nama_organisasi', value: nama_organisasi || 'PAMSIMAS', label: 'Nama Organisasi' }),
    AppSetting.upsert({ key: 'alamat_organisasi', value: alamat_organisasi || '', label: 'Alamat Organisasi' }),
  ]);
  req.flash('success', 'Pengaturan transparansi publik berhasil disimpan');
  res.redirect('/pengaturan/publik');
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
