const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireLogin, requireRole } = require('../middleware/auth');
const { Pengeluaran, User } = require('../models');
const { log } = require('../helpers/audit');

const LABEL_KATEGORI = {
  operasional: 'Operasional',
  pemeliharaan: 'Pemeliharaan',
  gaji: 'Gaji / Honor',
  utilitas: 'Listrik / Air / Internet',
  perlengkapan: 'Perlengkapan',
  lain_lain: 'Lain-lain',
};

async function genNoPengeluaran() {
  const last = await Pengeluaran.findOne({
    where: { no_pengeluaran: { [Op.like]: 'PGL%' } },
    order: [['id', 'DESC']],
  });
  const num = last ? (parseInt((last.no_pengeluaran || '').replace(/\D/g, '')) || 0) : 0;
  return 'PGL' + String(num + 1).padStart(5, '0');
}

// Index
router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  const { q, kategori, sumber_dana, dari, sampai, page = 1 } = req.query;
  const limit = 20;
  const offset = (parseInt(page) - 1) * limit;
  const where = {};

  if (q) where[Op.or] = [
    { no_pengeluaran: { [Op.like]: `%${q}%` } },
    { keterangan: { [Op.like]: `%${q}%` } },
  ];
  if (kategori) where.kategori = kategori;
  if (sumber_dana) where.sumber_dana = sumber_dana;
  if (dari) where.tanggal = { ...where.tanggal, [Op.gte]: dari };
  if (sampai) where.tanggal = { ...where.tanggal, [Op.lte]: sampai };

  const [{ count, rows }, total] = await Promise.all([
    Pengeluaran.findAndCountAll({
      where,
      include: [{ model: User, as: 'pencatat', attributes: ['nama'] }],
      order: [['tanggal', 'DESC'], ['id', 'DESC']],
      limit, offset,
    }),
    Pengeluaran.sum('jumlah', { where }) || 0,
  ]);

  res.render('pengeluaran/index', {
    currentPage: 'pengeluaran',
    list: rows, count, total: total || 0,
    totalPages: Math.ceil(count / limit), page: parseInt(page), limit,
    q, kategori, sumber_dana, dari, sampai, LABEL_KATEGORI,
  });
});

// Form tambah
router.get('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  res.render('pengeluaran/form', {
    currentPage: 'pengeluaran', mode: 'tambah',
    pengeluaran: { tanggal: new Date().toISOString().slice(0, 10) },
    LABEL_KATEGORI,
  });
});

// Simpan
router.post('/tambah', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const no_pengeluaran = await genNoPengeluaran();
    const data = await Pengeluaran.create({
      ...req.body,
      no_pengeluaran,
      jumlah: parseFloat(req.body.jumlah) || 0,
      created_by: req.session.user.id,
    });
    await log(req.session.user.id, 'CREATE', 'pengeluaran', data.id, null, data.toJSON(), req.ip, `Tambah pengeluaran ${data.no_pengeluaran}`);
    req.flash('success', `Pengeluaran ${data.no_pengeluaran} berhasil dicatat`);
    res.redirect('/pengeluaran');
  } catch (e) {
    req.flash('error', e.message || 'Gagal menyimpan pengeluaran');
    res.redirect('/pengeluaran/tambah');
  }
});

// Form edit
router.get('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const pengeluaran = await Pengeluaran.findByPk(req.params.id);
  if (!pengeluaran) { req.flash('error', 'Data tidak ditemukan'); return res.redirect('/pengeluaran'); }
  res.render('pengeluaran/form', {
    currentPage: 'pengeluaran', mode: 'edit', pengeluaran, LABEL_KATEGORI,
  });
});

// Update
router.post('/:id/edit', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const pengeluaran = await Pengeluaran.findByPk(req.params.id);
    if (!pengeluaran) { req.flash('error', 'Data tidak ditemukan'); return res.redirect('/pengeluaran'); }
    const old = pengeluaran.toJSON();
    await pengeluaran.update({ ...req.body, jumlah: parseFloat(req.body.jumlah) || 0 });
    await log(req.session.user.id, 'UPDATE', 'pengeluaran', pengeluaran.id, old, pengeluaran.toJSON(), req.ip, `Edit pengeluaran ${pengeluaran.no_pengeluaran}`);
    req.flash('success', 'Pengeluaran berhasil diperbarui');
    res.redirect('/pengeluaran');
  } catch (e) {
    req.flash('error', e.message || 'Gagal memperbarui');
    res.redirect(`/pengeluaran/${req.params.id}/edit`);
  }
});

// Hapus
router.post('/:id/hapus', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const pengeluaran = await Pengeluaran.findByPk(req.params.id);
    if (!pengeluaran) { req.flash('error', 'Data tidak ditemukan'); return res.redirect('/pengeluaran'); }
    await log(req.session.user.id, 'DELETE', 'pengeluaran', pengeluaran.id, pengeluaran.toJSON(), null, req.ip, `Hapus pengeluaran ${pengeluaran.no_pengeluaran}`);
    await pengeluaran.destroy();
    req.flash('success', 'Pengeluaran berhasil dihapus');
    res.redirect('/pengeluaran');
  } catch (e) {
    req.flash('error', e.message || 'Gagal menghapus');
    res.redirect('/pengeluaran');
  }
});

module.exports = router;
