const express = require('express');
const router = express.Router();
const { requireLogin, requireRole } = require('../middleware/auth');
const { Tarif, KategoriPelanggan } = require('../models');
const { log } = require('../helpers/audit');

router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  const tarifList = await Tarif.findAll({
    include: [{ model: KategoriPelanggan, as: 'kategori' }],
    order: [['is_active', 'DESC'], ['nama_tarif', 'ASC']],
  });
  res.render('tarif/index', { currentPage: 'tarif', tarifList });
});

router.get('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const kategoriList = await KategoriPelanggan.findAll({ order: [['nama', 'ASC']] });
  res.render('tarif/form', { currentPage: 'tarif', mode: 'tambah', tarif: {}, kategoriList });
});

router.post('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const tarif = await Tarif.create(req.body);
    await log(req.session.user.id, 'CREATE', 'tarif', tarif.id, null, tarif.toJSON(), req.ip, `Tambah tarif ${tarif.nama_tarif}`);
    req.flash('success', `Tarif ${tarif.nama_tarif} berhasil ditambahkan`);
    res.redirect('/tarif');
  } catch (e) {
    req.flash('error', e.message || 'Gagal menambahkan tarif');
    res.redirect('/tarif/tambah');
  }
});

router.get('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const tarif = await Tarif.findByPk(req.params.id);
  if (!tarif) { req.flash('error', 'Tarif tidak ditemukan'); return res.redirect('/tarif'); }
  const kategoriList = await KategoriPelanggan.findAll({ order: [['nama', 'ASC']] });
  res.render('tarif/form', { currentPage: 'tarif', mode: 'edit', tarif, kategoriList });
});

router.post('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const tarif = await Tarif.findByPk(req.params.id);
    if (!tarif) { req.flash('error', 'Tarif tidak ditemukan'); return res.redirect('/tarif'); }
    const old = tarif.toJSON();
    await tarif.update(req.body);
    await log(req.session.user.id, 'UPDATE', 'tarif', tarif.id, old, tarif.toJSON(), req.ip, `Edit tarif ${tarif.nama_tarif}`);
    req.flash('success', 'Tarif berhasil diperbarui');
    res.redirect('/tarif');
  } catch (e) {
    req.flash('error', e.message || 'Gagal memperbarui tarif');
    res.redirect(`/tarif/${req.params.id}/edit`);
  }
});

router.post('/:id/toggle', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const tarif = await Tarif.findByPk(req.params.id);
  if (tarif) {
    await tarif.update({ is_active: !tarif.is_active });
    req.flash('success', `Tarif ${tarif.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
  }
  res.redirect('/tarif');
});

module.exports = router;
