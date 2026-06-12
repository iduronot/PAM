const express = require('express');
const router = express.Router();
const { requireLogin, requireRole } = require('../middleware/auth');
const { Pemasukan, User } = require('../models');
const { log } = require('../helpers/audit');
const { Op } = require('sequelize');

const LABEL_KATEGORI = {
  hibah_desa: 'Hibah Desa',
  hibah_kecamatan: 'Hibah Kecamatan',
  hibah_pemerintah: 'Hibah Pemerintah / Pusat',
  donasi: 'Donasi / Sumbangan',
  retribusi: 'Retribusi / Iuran Lain',
  lain_lain: 'Lain-lain',
};

async function genNoPemasukan() {
  const last = await Pemasukan.findOne({ where: { no_pemasukan: { [Op.like]: 'PMS%' } }, order: [['id', 'DESC']] });
  const num = last ? (parseInt((last.no_pemasukan || '').replace(/\D/g, '')) || 0) : 0;
  return 'PMS' + String(num + 1).padStart(5, '0');
}

// List
router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  const { q, kategori, dari, sampai, page = 1 } = req.query;
  const limit = 20;
  const offset = (parseInt(page) - 1) * limit;
  const where = {};
  if (q) where[Op.or] = [{ no_pemasukan: { [Op.like]: `%${q}%` } }, { sumber: { [Op.like]: `%${q}%` } }, { keterangan: { [Op.like]: `%${q}%` } }];
  if (kategori) where.kategori = kategori;
  if (dari) where.tanggal = { ...(where.tanggal || {}), [Op.gte]: dari };
  if (sampai) where.tanggal = { ...(where.tanggal || {}), [Op.lte]: sampai };

  const [{ count, rows }, totalJumlah] = await Promise.all([
    Pemasukan.findAndCountAll({ where, include: [{ model: User, as: 'pencatat', attributes: ['nama'] }], order: [['tanggal', 'DESC'], ['id', 'DESC']], limit, offset }),
    Pemasukan.sum('jumlah', { where }),
  ]);

  res.render('pemasukan/index', {
    currentPage: 'pemasukan',
    list: rows, count, totalPages: Math.ceil(count / limit), page: parseInt(page), limit,
    totalJumlah: totalJumlah || 0, q, kategori, dari, sampai, LABEL_KATEGORI,
  });
});

// Form tambah
router.get('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), (req, res) => {
  res.render('pemasukan/form', { currentPage: 'pemasukan', mode: 'tambah', data: {}, LABEL_KATEGORI });
});

router.post('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const no_pemasukan = await genNoPemasukan();
    const item = await Pemasukan.create({ ...req.body, no_pemasukan, created_by: req.session.user.id });
    await log(req.session.user.id, 'CREATE', 'pemasukan', item.id, null, req.body, req.ip);
    req.flash('success', `Pemasukan ${no_pemasukan} berhasil ditambahkan`);
    res.redirect('/pemasukan');
  } catch (e) {
    console.error('[POST /pemasukan/tambah]', e.message);
    req.flash('error', e.message || 'Gagal menyimpan');
    res.redirect('/pemasukan/tambah');
  }
});

// Form edit
router.get('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const data = await Pemasukan.findByPk(req.params.id);
  if (!data) { req.flash('error', 'Data tidak ditemukan'); return res.redirect('/pemasukan'); }
  res.render('pemasukan/form', { currentPage: 'pemasukan', mode: 'edit', data, LABEL_KATEGORI });
});

router.post('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const item = await Pemasukan.findByPk(req.params.id);
    if (!item) { req.flash('error', 'Data tidak ditemukan'); return res.redirect('/pemasukan'); }
    await item.update(req.body);
    await log(req.session.user.id, 'UPDATE', 'pemasukan', item.id, null, req.body, req.ip);
    req.flash('success', 'Pemasukan berhasil diperbarui');
    res.redirect('/pemasukan');
  } catch (e) {
    req.flash('error', e.message || 'Gagal memperbarui');
    res.redirect(`/pemasukan/${req.params.id}/edit`);
  }
});

// Hapus
router.post('/:id/hapus', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const item = await Pemasukan.findByPk(req.params.id);
    if (item) {
      await log(req.session.user.id, 'DELETE', 'pemasukan', item.id, item.toJSON(), null, req.ip);
      await item.destroy();
      req.flash('success', 'Pemasukan berhasil dihapus');
    }
  } catch (e) {
    req.flash('error', 'Gagal menghapus');
  }
  res.redirect('/pemasukan');
});

module.exports = router;
