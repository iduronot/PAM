const express = require('express');
const router = express.Router();
const { requireLogin, requireRole } = require('../middleware/auth');
const { Tagihan, Pelanggan, PeriodeBaca, PencatatanMeter, Tarif, Pembayaran, KategoriPelanggan } = require('../models');
const { generateNomorTagihan } = require('../helpers/format');
const { log } = require('../helpers/audit');
const { Op } = require('sequelize');

// List tagihan
router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'kasir', 'manajer'), async (req, res) => {
  const { q, status, page = 1 } = req.query;
  const limit = 25;
  const offset = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;

  // Auto-pilih periode bulan berjalan jika tidak ada filter periode dari user
  let periode_id = req.query.periode_id;
  if (!periode_id && !q && !status) {
    const now = new Date();
    const periodeBulanIni = await PeriodeBaca.findOne({
      where: { bulan: now.getMonth() + 1, tahun: now.getFullYear() },
    });
    if (periodeBulanIni) periode_id = String(periodeBulanIni.id);
  }
  if (periode_id) where.periode_id = periode_id;

  const includeOpts = [
    { model: Pelanggan, as: 'pelanggan' },
    { model: PeriodeBaca, as: 'periode' },
  ];

  if (q) {
    const pelangganIds = await Pelanggan.findAll({
      where: { [Op.or]: [{ nama: { [Op.like]: `%${q}%` } }, { no_pelanggan: { [Op.like]: `%${q}%` } }] },
      attributes: ['id'],
    });
    where.pelanggan_id = { [Op.in]: pelangganIds.map(p => p.id) };
  }

  const { count, rows } = await Tagihan.findAndCountAll({
    where, limit, offset, include: includeOpts,
    order: [['createdAt', 'DESC']],
  });

  const periodeList = await PeriodeBaca.findAll({ order: [['tahun', 'DESC'], ['bulan', 'DESC']] });
  const totalPages = Math.ceil(count / limit);

  res.render('tagihan/index', {
    currentPage: 'tagihan',
    tagihanList: rows, count, totalPages, page: parseInt(page), limit,
    periodeList, q, status, periode_id,
  });
});

// Generate tagihan dari periode
router.get('/generate', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const periodeList = await PeriodeBaca.findAll({
    where: { status: { [Op.ne]: 'selesai' } },
    order: [['tahun', 'DESC'], ['bulan', 'DESC']],
  });
  const tarifList = await Tarif.findAll({ where: { is_active: true }, order: [['nama_tarif', 'ASC']] });
  res.render('tagihan/generate', { currentPage: 'tagihan', periodeList, tarifList });
});

router.post('/generate', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const { periode_id, tarif_id } = req.body;
  try {
    const tarif = await Tarif.findByPk(tarif_id);
    if (!tarif) { req.flash('error', 'Tarif tidak ditemukan'); return res.redirect('/tagihan/generate'); }

    const periode = await PeriodeBaca.findByPk(periode_id);
    if (!periode) { req.flash('error', 'Periode tidak ditemukan'); return res.redirect('/tagihan/generate'); }

    // Ambil semua pencatatan verified di periode ini
    const pencatatanList = await PencatatanMeter.findAll({
      where: { periode_id, status_verifikasi: 'verified', status: 'terbaca' },
      include: [{ model: Pelanggan, as: 'pelanggan' }],
    });

    let created = 0, skipped = 0;
    for (const p of pencatatanList) {
      // Cek sudah ada tagihan
      const existing = await Tagihan.findOne({ where: { periode_id, pelanggan_id: p.pelanggan_id } });
      if (existing) { skipped++; continue; }

      const pemakaian = parseFloat(p.pemakaian) || 0;
      const subtotal_air = pemakaian * parseFloat(tarif.harga_per_m3);
      const biaya_minimum = pemakaian < parseFloat(tarif.minimum_m3) ? parseFloat(tarif.biaya_minimum) : 0;
      const total_tagihan = subtotal_air + parseFloat(tarif.biaya_admin) + biaya_minimum;
      const no_tagihan = generateNomorTagihan(periode_id, p.pelanggan_id);

      await Tagihan.create({
        no_tagihan,
        periode_id,
        pelanggan_id: p.pelanggan_id,
        pencatatan_meter_id: p.id,
        pemakaian,
        tarif_id: tarif.id,
        harga_per_m3: tarif.harga_per_m3,
        subtotal_air,
        biaya_admin: tarif.biaya_admin,
        biaya_minimum,
        denda: 0,
        penyesuaian: 0,
        total_tagihan,
        tanggal_jatuh_tempo: periode.tanggal_jatuh_tempo,
        status: 'final',
        created_by: req.session.user.id,
      });
      created++;
    }

    await log(req.session.user.id, 'GENERATE_TAGIHAN', 'tagihan', periode_id, null, { created, skipped }, req.ip);
    req.flash('success', `${created} tagihan berhasil dibuat, ${skipped} sudah ada`);
    res.redirect(`/tagihan?periode_id=${periode_id}`);
  } catch (e) {
    req.flash('error', e.message || 'Gagal generate tagihan');
    res.redirect('/tagihan/generate');
  }
});

// Finalisasi tagihan (draft → final)
router.post('/finalisasi', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const { periode_id } = req.body;
  const where = { status: 'draft' };
  if (periode_id) where.periode_id = periode_id;
  const updated = await Tagihan.update({ status: 'final' }, { where });
  await log(req.session.user.id, 'FINALISASI_TAGIHAN', 'tagihan', periode_id || null, null, null, req.ip, `Finalisasi ${updated[0]} tagihan draft`);
  req.flash('success', `${updated[0]} tagihan berhasil difinalisasi`);
  res.redirect(periode_id ? `/tagihan?periode_id=${periode_id}` : '/tagihan');
});

// Detail tagihan
router.get('/:id', requireLogin, requireRole('super_admin', 'admin_pam', 'kasir', 'manajer'), async (req, res) => {
  const tagihan = await Tagihan.findByPk(req.params.id, {
    include: [
      { model: Pelanggan, as: 'pelanggan' },
      { model: PeriodeBaca, as: 'periode' },
      { model: Tarif, as: 'tarif' },
      { model: Pembayaran, as: 'pembayaran' },
    ],
  });
  if (!tagihan) { req.flash('error', 'Tagihan tidak ditemukan'); return res.redirect('/tagihan'); }
  res.render('tagihan/detail', { currentPage: 'tagihan', tagihan });
});

// Batalkan tagihan
router.post('/:id/batal', requireLogin, requireRole('super_admin'), async (req, res) => {
  const tagihan = await Tagihan.findByPk(req.params.id);
  if (tagihan && tagihan.status !== 'lunas') {
    const old = tagihan.toJSON();
    await tagihan.update({ status: 'dibatalkan', catatan_koreksi: req.body.catatan });
    await log(req.session.user.id, 'BATAL_TAGIHAN', 'tagihan', tagihan.id, old, null, req.ip, req.body.catatan);
    req.flash('success', 'Tagihan dibatalkan');
  }
  res.redirect(`/tagihan/${req.params.id}`);
});

module.exports = router;
