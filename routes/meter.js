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
  const { q, status, page = 1 } = req.query;
  const { Op } = require('sequelize');
  const limit = 20;
  const offset = (parseInt(page) - 1) * limit;
  const where = {};
  if (status) where.status = status;
  if (q) {
    const plg = await Pelanggan.findAll({
      where: { [Op.or]: [{ nama: { [Op.like]: `%${q}%` } }, { no_pelanggan: { [Op.like]: `%${q}%` } }] },
      attributes: ['id'],
    });
    where[Op.or] = [
      { no_meter: { [Op.like]: `%${q}%` } },
      ...(plg.length ? [{ pelanggan_id: { [Op.in]: plg.map(p => p.id) } }] : []),
    ];
  }
  const { count, rows } = await Meter.findAndCountAll({
    where, include: [{ model: Pelanggan, as: 'pelanggan' }],
    order: [['no_meter', 'ASC']], limit, offset, distinct: true,
  });
  res.render('meter/index', { currentPage: 'meter', meterList: rows, count, totalPages: Math.ceil(count / limit), page: parseInt(page), limit, q, status });
});

router.get('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const pelangganList = await Pelanggan.findAll({ where: { status: 'aktif' }, order: [['nama', 'ASC']] });
  res.render('meter/form', { currentPage: 'meter', mode: 'tambah', meter: {}, pelangganList, pelangkan_id: req.query.pelanggan_id });
});

router.post('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), upload.single('foto_awal'), async (req, res) => {
  const redirectTo = req.body.redirect_to || '/meter';
  try {
    const data = { ...req.body };
    delete data.redirect_to;
    // Auto-generate no_meter dengan prefix GT jika tidak diisi
    if (!data.no_meter || !data.no_meter.trim()) {
      const { Op } = require('sequelize');
      const last = await Meter.findOne({ where: { no_meter: { [Op.like]: 'GT%' } }, order: [['id', 'DESC']] });
      const num = last ? (parseInt((last.no_meter || '').replace(/\D/g, '')) || 0) : 0;
      data.no_meter = 'GT' + String(num + 1).padStart(4, '0');
    }
    if (req.file) data.foto_awal = '/uploads/meter/' + req.file.filename;
    const meter = await Meter.create(data);
    await log(req.session.user.id, 'CREATE', 'meter', meter.id, null, meter.toJSON(), req.ip, `Tambah meter ${meter.no_meter}`);
    req.flash('success', `Meter ${meter.no_meter} berhasil ditambahkan`);
    res.redirect(redirectTo);
  } catch (e) {
    req.flash('error', e.message || 'Gagal menambahkan meter');
    res.redirect(redirectTo);
  }
});

router.get('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const meter = await Meter.findByPk(req.params.id);
  if (!meter) { req.flash('error', 'Meter tidak ditemukan'); return res.redirect('/meter'); }
  const pelangganList = await Pelanggan.findAll({ order: [['nama', 'ASC']] });
  res.render('meter/form', { currentPage: 'meter', mode: 'edit', meter, pelangganList });
});

router.post('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), upload.single('foto_awal'), async (req, res) => {
  const redirectTo = req.body.redirect_to || '/meter';
  try {
    const meter = await Meter.findByPk(req.params.id);
    if (!meter) { req.flash('error', 'Meter tidak ditemukan'); return res.redirect(redirectTo); }
    const old = meter.toJSON();
    const data = { ...req.body };
    delete data.redirect_to;
    if (req.file) data.foto_awal = '/uploads/meter/' + req.file.filename;
    await meter.update(data);
    await log(req.session.user.id, 'UPDATE', 'meter', meter.id, old, meter.toJSON(), req.ip, `Edit meter ${meter.no_meter}`);
    req.flash('success', 'Data meter berhasil diperbarui');
    res.redirect(redirectTo);
  } catch (e) {
    req.flash('error', e.message || 'Gagal memperbarui');
    res.redirect(redirectTo);
  }
});

module.exports = router;
