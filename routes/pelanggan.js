const express = require('express');
const router = express.Router();
const { requireLogin, requireRole } = require('../middleware/auth');
const { Pelanggan, Meter, KategoriPelanggan, Rute, Tagihan, User } = require('../models');
const { generateNoPelanggan } = require('../helpers/format');
const { log } = require('../helpers/audit');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

const adminRoles = ['super_admin', 'admin_pam', 'manajer'];

// List
router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'kasir'), async (req, res) => {
  const { q, status, kategori_id, rute_id, page = 1 } = req.query;
  const limit = 20;
  const offset = (page - 1) * limit;
  const where = {};
  if (q) where[Op.or] = [
    { nama: { [Op.like]: `%${q}%` } },
    { no_pelanggan: { [Op.like]: `%${q}%` } },
    { no_sambungan: { [Op.like]: `%${q}%` } },
    { no_hp: { [Op.like]: `%${q}%` } },
    { alamat: { [Op.like]: `%${q}%` } },
  ];
  if (status) where.status = status;
  if (kategori_id) where.kategori_id = kategori_id;
  if (rute_id) where.rute_id = rute_id;

  const { count, rows } = await Pelanggan.findAndCountAll({
    where, limit, offset,
    include: [
      { model: KategoriPelanggan, as: 'kategori' },
      { model: Rute, as: 'rute' },
    ],
    order: [['no_pelanggan', 'ASC']],
  });

  const kategoriList = await KategoriPelanggan.findAll({ order: [['nama', 'ASC']] });
  const ruteList = await Rute.findAll({ order: [['urutan', 'ASC']] });
  const totalPages = Math.ceil(count / limit);

  res.render('pelanggan/index', {
    currentPage: 'pelanggan',
    pelangganList: rows, count, totalPages, page: parseInt(page),
    kategoriList, ruteList, q, status, kategori_id, rute_id,
  });
});

// Form tambah
router.get('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const kategoriList = await KategoriPelanggan.findAll({ order: [['nama', 'ASC']] });
  const ruteList = await Rute.findAll({ order: [['urutan', 'ASC']] });
  res.render('pelanggan/form', {
    currentPage: 'pelanggan', mode: 'tambah',
    pelanggan: {}, kategoriList, ruteList,
  });
});

// Simpan
router.post('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const lastPelanggan = await Pelanggan.findOne({ order: [['id', 'DESC']] });
    const no_pelanggan = generateNoPelanggan(lastPelanggan ? lastPelanggan.id : 0);
    const pelanggan = await Pelanggan.create({ ...req.body, no_pelanggan });
    await log(req.session.user.id, 'CREATE', 'pelanggan', pelanggan.id, null, pelanggan.toJSON(), req.ip, `Tambah pelanggan ${pelanggan.nama}`);

    // Buat akun user pelanggan jika diminta
    if (req.body.buat_akun === '1' && req.body.username_akun) {
      const hash = await bcrypt.hash(req.body.password_akun || pelanggan.no_pelanggan, 10);
      await User.create({
        nama: pelanggan.nama,
        username: req.body.username_akun,
        email: pelanggan.email,
        password: hash,
        role: 'pelanggan',
        pelanggan_id: pelanggan.id,
      });
    }

    req.flash('success', `Pelanggan ${pelanggan.nama} berhasil ditambahkan (${no_pelanggan})`);
    res.redirect('/pelanggan');
  } catch (e) {
    req.flash('error', e.message || 'Gagal menambahkan pelanggan');
    res.redirect('/pelanggan/tambah');
  }
});

// Detail
router.get('/:id', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'kasir', 'petugas_meter'), async (req, res) => {
  const pelanggan = await Pelanggan.findByPk(req.params.id, {
    include: [
      { model: KategoriPelanggan, as: 'kategori' },
      { model: Rute, as: 'rute' },
      { model: Meter, as: 'meter' },
    ],
  });
  if (!pelanggan) { req.flash('error', 'Pelanggan tidak ditemukan'); return res.redirect('/pelanggan'); }
  const tagihanTerbuka = await Tagihan.findAll({
    where: { pelanggan_id: pelanggan.id, status: { [Op.in]: ['final', 'terlambat'] } },
    limit: 5, order: [['createdAt', 'DESC']],
  });
  res.render('pelanggan/detail', { currentPage: 'pelanggan', pelanggan, tagihanTerbuka });
});

// Form edit
router.get('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const pelanggan = await Pelanggan.findByPk(req.params.id);
  if (!pelanggan) { req.flash('error', 'Pelanggan tidak ditemukan'); return res.redirect('/pelanggan'); }
  const kategoriList = await KategoriPelanggan.findAll({ order: [['nama', 'ASC']] });
  const ruteList = await Rute.findAll({ order: [['urutan', 'ASC']] });
  res.render('pelanggan/form', { currentPage: 'pelanggan', mode: 'edit', pelanggan, kategoriList, ruteList });
});

// Update
router.post('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const pelanggan = await Pelanggan.findByPk(req.params.id);
    if (!pelanggan) { req.flash('error', 'Pelanggan tidak ditemukan'); return res.redirect('/pelanggan'); }
    const old = pelanggan.toJSON();
    await pelanggan.update(req.body);
    await log(req.session.user.id, 'UPDATE', 'pelanggan', pelanggan.id, old, pelanggan.toJSON(), req.ip, `Edit pelanggan ${pelanggan.nama}`);
    req.flash('success', 'Data pelanggan berhasil diperbarui');
    res.redirect(`/pelanggan/${pelanggan.id}`);
  } catch (e) {
    req.flash('error', e.message || 'Gagal memperbarui data');
    res.redirect(`/pelanggan/${req.params.id}/edit`);
  }
});

// Nonaktifkan
router.post('/:id/status', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const pelanggan = await Pelanggan.findByPk(req.params.id);
  if (pelanggan) {
    const old = pelanggan.toJSON();
    await pelanggan.update({ status: req.body.status });
    await log(req.session.user.id, 'STATUS', 'pelanggan', pelanggan.id, old, { status: req.body.status }, req.ip, `Status pelanggan diubah ke ${req.body.status}`);
    req.flash('success', 'Status pelanggan diperbarui');
  }
  res.redirect(`/pelanggan/${req.params.id}`);
});

module.exports = router;
