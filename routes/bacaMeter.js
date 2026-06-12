const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { requireLogin, requireRole } = require('../middleware/auth');
const { PencatatanMeter, PeriodeBaca, Pelanggan, Meter, Rute, User, Tagihan, Tarif } = require('../models');
const { generateNomorTagihan } = require('../helpers/format');
const { log } = require('../helpers/audit');
const { Op } = require('sequelize');

const storage = multer.diskStorage({
  destination: 'public/uploads/meter/',
  filename: (req, file, cb) => cb(null, `baca_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// List periode
router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'petugas_meter'), async (req, res) => {
  const { tahun, status } = req.query;
  const where = {};
  if (tahun) where.tahun = tahun;
  if (status) where.status = status;
  const periodeList = await PeriodeBaca.findAll({ where, order: [['tahun', 'DESC'], ['bulan', 'DESC']] });
  const tahunList = await PeriodeBaca.findAll({ attributes: ['tahun'], group: ['tahun'], order: [['tahun', 'DESC']] });
  res.render('baca_meter/index', { currentPage: 'baca_meter', periodeList, tahunList, tahun, status });
});

// Buat periode baru
router.get('/periode/buat', requireLogin, requireRole('super_admin', 'admin_pam'), (req, res) => {
  const now = new Date();
  res.render('baca_meter/periode_form', {
    currentPage: 'baca_meter',
    bulanDefault: now.getMonth() + 1,
    tahunDefault: now.getFullYear(),
  });
});

router.post('/periode/buat', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const { bulan, tahun, tanggal_mulai, tanggal_selesai, tanggal_jatuh_tempo } = req.body;
    const namaBulan = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const nama_periode = `${namaBulan[bulan]} ${tahun}`;

    const existing = await PeriodeBaca.findOne({ where: { bulan, tahun } });
    if (existing) { req.flash('error', 'Periode ini sudah ada'); return res.redirect('/baca-meter'); }

    const periode = await PeriodeBaca.create({ nama_periode, bulan, tahun, tanggal_mulai, tanggal_selesai, tanggal_jatuh_tempo });

    // Buat record pencatatan untuk semua pelanggan aktif
    const pelangganAktif = await Pelanggan.findAll({
      where: { status: 'aktif' },
      include: [{ model: Meter, as: 'meter', where: { status: 'aktif' }, required: false }],
    });

    for (const p of pelangganAktif) {
      const meterAktif = p.meter && p.meter.length > 0 ? p.meter[0] : null;
      if (!meterAktif) continue;

      // Angka sebelumnya = angka sekarang periode lalu
      const bacaLalu = await PencatatanMeter.findOne({
        where: { pelanggan_id: p.id },
        order: [['createdAt', 'DESC']],
      });
      const angka_sebelumnya = bacaLalu ? bacaLalu.angka_sekarang : meterAktif.angka_awal;

      await PencatatanMeter.create({
        periode_id: periode.id,
        pelanggan_id: p.id,
        meter_id: meterAktif.id,
        angka_sebelumnya: angka_sebelumnya || 0,
        status: 'belum_dibaca',
        status_verifikasi: 'pending',
      });
    }

    req.flash('success', `Periode ${nama_periode} dibuat, ${pelangganAktif.length} pelanggan disiapkan`);
    res.redirect(`/baca-meter/periode/${periode.id}`);
  } catch (e) {
    req.flash('error', e.message || 'Gagal membuat periode');
    res.redirect('/baca-meter');
  }
});

// Detail periode - daftar pencatatan
router.get('/periode/:periodeId', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'petugas_meter'), async (req, res) => {
  const periode = await PeriodeBaca.findByPk(req.params.periodeId);
  if (!periode) { req.flash('error', 'Periode tidak ditemukan'); return res.redirect('/baca-meter'); }

  const { rute_id, status, q, page = 1 } = req.query;
  const limit = 25;
  const offset = (parseInt(page) - 1) * limit;
  const where = { periode_id: periode.id };
  if (status) where.status = status;

  const pelangganWhere = {};
  if (rute_id) pelangganWhere.rute_id = rute_id;
  if (q && q.trim()) pelangganWhere[Op.or] = [
    { nama: { [Op.like]: `%${q.trim()}%` } },
    { no_pelanggan: { [Op.like]: `%${q.trim()}%` } },
  ];
  const hasPelangganFilter = Object.keys(pelangganWhere).length > 0;
  const pelangganInclude = { model: Pelanggan, as: 'pelanggan', include: [{ model: Rute, as: 'rute' }], where: hasPelangganFilter ? pelangganWhere : undefined, required: hasPelangganFilter };

  const [rowCount, pencatatanList, ruteList, statsTotal, statsTerbaca, statsBelum, statsAnomali, statsVerified] = await Promise.all([
    PencatatanMeter.count({ where, include: hasPelangganFilter ? [{ model: Pelanggan, as: 'pelanggan', where: pelangganWhere, required: true }] : [] }),
    PencatatanMeter.findAll({
      where,
      include: [pelangganInclude, { model: Meter, as: 'meter' }, { model: User, as: 'petugas' }],
      order: [[{ model: Pelanggan, as: 'pelanggan' }, 'no_pelanggan', 'ASC']],
      limit, offset,
    }),
    Rute.findAll({ order: [['urutan', 'ASC']] }),
    PencatatanMeter.count({ where: { periode_id: periode.id } }),
    PencatatanMeter.count({ where: { periode_id: periode.id, status: 'terbaca' } }),
    PencatatanMeter.count({ where: { periode_id: periode.id, status: 'belum_dibaca' } }),
    PencatatanMeter.count({ where: { periode_id: periode.id, status: 'anomali' } }),
    PencatatanMeter.count({ where: { periode_id: periode.id, status_verifikasi: 'verified' } }),
  ]);

  const stats = { total: statsTotal, terbaca: statsTerbaca, belum: statsBelum, anomali: statsAnomali, verified: statsVerified };
  const totalPages = Math.ceil(rowCount / limit);

  res.render('baca_meter/detail_periode', { currentPage: 'baca_meter', periode, pencatatanList, ruteList, stats, rute_id, status, q: q || '', rowCount, totalPages, page: parseInt(page), limit });
});

// Form input baca meter
router.get('/input/:id', requireLogin, requireRole('super_admin', 'admin_pam', 'petugas_meter'), async (req, res) => {
  const pencatatan = await PencatatanMeter.findByPk(req.params.id, {
    include: [
      { model: Pelanggan, as: 'pelanggan' },
      { model: Meter, as: 'meter' },
      { model: PeriodeBaca, as: 'periode' },
    ],
  });
  if (!pencatatan) { req.flash('error', 'Data tidak ditemukan'); return res.redirect('/baca-meter'); }
  res.render('baca_meter/input', { currentPage: 'baca_meter', pencatatan });
});

// Simpan hasil baca
router.post('/input/:id', requireLogin, requireRole('super_admin', 'admin_pam', 'petugas_meter'), upload.single('foto_meter'), async (req, res) => {
  try {
    const pencatatan = await PencatatanMeter.findByPk(req.params.id);
    if (!pencatatan) { req.flash('error', 'Data tidak ditemukan'); return res.redirect('/baca-meter'); }

    const { angka_sekarang, status, catatan } = req.body;
    const data = {
      angka_sekarang: parseFloat(angka_sekarang) || 0,
      status: status || 'terbaca',
      catatan,
      petugas_id: req.session.user.id,
      tanggal_baca: new Date(),
    };

    if (data.angka_sekarang < pencatatan.angka_sebelumnya && status === 'terbaca') {
      data.status = 'anomali';
    }
    data.pemakaian = Math.max(0, data.angka_sekarang - pencatatan.angka_sebelumnya);

    if (req.file) data.foto_meter = '/uploads/meter/' + req.file.filename;
    if (req.session.user.role !== 'petugas_meter') data.status_verifikasi = 'verified';

    await pencatatan.update(data);
    await log(req.session.user.id, 'BACA_METER', 'pencatatan_meter', pencatatan.id, null, data, req.ip, `Input meter pelanggan`);

    req.flash('success', `Baca meter berhasil disimpan, pemakaian: ${data.pemakaian} m³`);
    if (req.body.langsung_bayar === '1') return res.redirect(`/baca-meter/catat-dan-bayar/${pencatatan.id}`);
    res.redirect(`/baca-meter/periode/${pencatatan.periode_id}`);
  } catch (e) {
    req.flash('error', e.message || 'Gagal menyimpan');
    res.redirect(`/baca-meter/input/${req.params.id}`);
  }
});

// Verifikasi oleh admin
router.post('/verifikasi/:id', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  const pencatatan = await PencatatanMeter.findByPk(req.params.id);
  if (pencatatan) {
    const aksi = req.body.aksi; // 'verified' atau 'rejected'
    await pencatatan.update({
      status_verifikasi: aksi,
      verified_by: req.session.user.id,
      verified_at: new Date(),
      catatan: req.body.catatan || pencatatan.catatan,
    });
    await log(req.session.user.id, 'VERIFIKASI_METER', 'pencatatan_meter', pencatatan.id, null, { status_verifikasi: aksi }, req.ip);
    req.flash('success', `Hasil baca meter ${aksi === 'verified' ? 'diverifikasi' : 'ditolak'}`);
  }
  res.redirect('back');
});

// Catat & langsung bayar (untuk petugas lapangan)
router.get('/catat-dan-bayar/:id', requireLogin, requireRole('super_admin', 'admin_pam', 'petugas_meter', 'kasir'), async (req, res) => {
  try {
    const pencatatan = await PencatatanMeter.findByPk(req.params.id, {
      include: [{ model: Pelanggan, as: 'pelanggan' }, { model: PeriodeBaca, as: 'periode' }],
    });
    if (!pencatatan) { req.flash('error', 'Data tidak ditemukan'); return res.redirect('/baca-meter'); }
    if (pencatatan.status === 'belum_dibaca') { req.flash('error', 'Meter belum dicatat'); return res.redirect(`/baca-meter/input/${pencatatan.id}`); }

    // Auto-verify
    if (pencatatan.status_verifikasi !== 'verified') {
      await pencatatan.update({ status_verifikasi: 'verified', verified_by: req.session.user.id, verified_at: new Date() });
    }

    // Cek tagihan sudah ada
    const existing = await Tagihan.findOne({
      where: { periode_id: pencatatan.periode_id, pelanggan_id: pencatatan.pelanggan_id, status: { [Op.ne]: 'dibatalkan' } },
    });
    if (existing) {
      if (existing.status === 'lunas') { req.flash('error', 'Tagihan periode ini sudah lunas'); return res.redirect(`/baca-meter/periode/${pencatatan.periode_id}`); }
      return res.redirect(`/pembayaran/catat?tagihan_id=${existing.id}`);
    }

    // Cari tarif sesuai kategori pelanggan, fallback ke tarif aktif pertama
    const pelanggan = pencatatan.pelanggan;
    const tarif = await Tarif.findOne({
      where: { is_active: true, ...(pelanggan?.kategori_id ? { kategori_id: pelanggan.kategori_id } : {}) },
      order: [['tanggal_berlaku', 'DESC']],
    }) || await Tarif.findOne({ where: { is_active: true }, order: [['tanggal_berlaku', 'DESC']] });

    if (!tarif) { req.flash('error', 'Tidak ada tarif aktif. Minta admin untuk mengatur tarif terlebih dahulu.'); return res.redirect(`/baca-meter/periode/${pencatatan.periode_id}`); }

    const pemakaian = parseFloat(pencatatan.pemakaian) || 0;
    const subtotal_air = pemakaian * parseFloat(tarif.harga_per_m3);
    const biaya_minimum = pemakaian < parseFloat(tarif.minimum_m3 || 0) ? parseFloat(tarif.biaya_minimum || 0) : 0;
    const total_tagihan = subtotal_air + parseFloat(tarif.biaya_admin || 0) + biaya_minimum;

    const tagihan = await Tagihan.create({
      no_tagihan: generateNomorTagihan(pencatatan.periode_id, pencatatan.pelanggan_id),
      periode_id: pencatatan.periode_id,
      pelanggan_id: pencatatan.pelanggan_id,
      pencatatan_meter_id: pencatatan.id,
      pemakaian,
      tarif_id: tarif.id,
      harga_per_m3: tarif.harga_per_m3,
      subtotal_air,
      biaya_admin: tarif.biaya_admin || 0,
      biaya_minimum,
      denda: 0,
      penyesuaian: 0,
      total_tagihan,
      tanggal_jatuh_tempo: pencatatan.periode?.tanggal_jatuh_tempo,
      status: 'final',
      created_by: req.session.user.id,
    });

    await log(req.session.user.id, 'GENERATE_TAGIHAN', 'tagihan', tagihan.id, null, { total_tagihan }, req.ip, `Tagihan langsung dari baca meter`);
    res.redirect(`/pembayaran/catat?tagihan_id=${tagihan.id}`);
  } catch (e) {
    req.flash('error', e.message || 'Gagal membuat tagihan');
    res.redirect(`/baca-meter/periode/${req.query.periode_id || ''}`);
  }
});

// Hapus periode
router.post('/periode/:periodeId/hapus', requireLogin, requireRole('super_admin', 'admin_pam'), async (req, res) => {
  try {
    const periode = await PeriodeBaca.findByPk(req.params.periodeId);
    if (!periode) { req.flash('error', 'Periode tidak ditemukan'); return res.redirect('/baca-meter'); }

    const jumlahTagihan = await Tagihan.count({ where: { periode_id: periode.id } });
    if (jumlahTagihan > 0) {
      req.flash('error', `Tidak dapat menghapus periode ${periode.nama_periode} — sudah ada ${jumlahTagihan} tagihan yang dibuat`);
      return res.redirect('/baca-meter');
    }

    await PencatatanMeter.destroy({ where: { periode_id: periode.id } });
    await periode.destroy();
    await log(req.session.user.id, 'DELETE', 'periode_baca', periode.id, periode.toJSON(), null, req.ip, `Hapus periode ${periode.nama_periode}`);

    req.flash('success', `Periode ${periode.nama_periode} berhasil dihapus`);
    res.redirect('/baca-meter');
  } catch (e) {
    req.flash('error', e.message || 'Gagal menghapus periode');
    res.redirect('/baca-meter');
  }
});

module.exports = router;
