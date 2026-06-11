const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { requireLogin, requireRole } = require('../middleware/auth');
const { Meter, Pelanggan } = require('../models');
const { log } = require('../helpers/audit');

const storage = multer.diskStorage({
  destination: 'public/uploads/meter/',
  filename: (req, file, cb) => cb(null, `meter_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  const { q, status, pelanggan_id } = req.query;
  const { Op } = require('sequelize');
  const where = {};
  if (status) where.status = status;
  if (pelanggan_id) where.pelanggan_id = pelanggan_id;

  const meterList = await Meter.findAll({
    where,
    include: [{ model: Pelanggan, as: 'pelanggan' }],
    order: [['no_meter', 'ASC']],
  });

  const filtered = q ? meterList.filter(m =>
    m.no_meter.toLowerCase().includes(q.toLowerCase()) ||
    (m.pelanggan && m.pelanggan.nama.toLowerCase().includes(q.toLowerCase()))
  ) : meterList;

  res.render('meter/index', { currentPage: 'meter', meterList: filtered, q, status });
});

router.get('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const pelangganList = await Pelanggan.findAll({ where: { status: 'aktif' }, order: [['nama', 'ASC']] });
  res.render('meter/form', { currentPage: 'meter', mode: 'tambah', meter: {}, pelangganList, pelangkan_id: req.query.pelanggan_id });
});

router.post('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), upload.single('foto_awal'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.foto_awal = '/uploads/meter/' + req.file.filename;
    const meter = await Meter.create(data);
    await log(req.session.user.id, 'CREATE', 'meter', meter.id, null, meter.toJSON(), req.ip, `Tambah meter ${meter.no_meter}`);
    req.flash('success', `Meter ${meter.no_meter} berhasil ditambahkan`);
    res.redirect('/meter');
  } catch (e) {
    req.flash('error', e.message || 'Gagal menambahkan meter');
    res.redirect('/meter/tambah');
  }
});

router.get('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const meter = await Meter.findByPk(req.params.id);
  if (!meter) { req.flash('error', 'Meter tidak ditemukan'); return res.redirect('/meter'); }
  const pelangganList = await Pelanggan.findAll({ order: [['nama', 'ASC']] });
  res.render('meter/form', { currentPage: 'meter', mode: 'edit', meter, pelangganList });
});

router.post('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), upload.single('foto_awal'), async (req, res) => {
  try {
    const meter = await Meter.findByPk(req.params.id);
    if (!meter) { req.flash('error', 'Meter tidak ditemukan'); return res.redirect('/meter'); }
    const old = meter.toJSON();
    const data = { ...req.body };
    if (req.file) data.foto_awal = '/uploads/meter/' + req.file.filename;
    await meter.update(data);
    await log(req.session.user.id, 'UPDATE', 'meter', meter.id, old, meter.toJSON(), req.ip, `Edit meter ${meter.no_meter}`);
    req.flash('success', 'Data meter berhasil diperbarui');
    res.redirect('/meter');
  } catch (e) {
    req.flash('error', e.message || 'Gagal memperbarui');
    res.redirect(`/meter/${req.params.id}/edit`);
  }
});

module.exports = router;
