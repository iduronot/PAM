const express = require('express');
const router = express.Router();
const { requireLogin, requireRole } = require('../middleware/auth');
const { Pelanggan, Tagihan, Pembayaran, Pengaduan, PencatatanMeter, PeriodeBaca, KategoriPelanggan, Rute } = require('../models');
const { Op } = require('sequelize');
const xl = require('excel4node');

const adminRoles = ['super_admin', 'admin_pam', 'manajer'];

router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  const periodeList = await PeriodeBaca.findAll({ order: [['tahun', 'DESC'], ['bulan', 'DESC']] });
  res.render('laporan/index', { currentPage: 'laporan', periodeList });
});

// Laporan tunggakan
router.get('/tunggakan', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'kasir'), async (req, res) => {
  const { kategori_id, export: doExport } = req.query;
  const where = { status: { [Op.in]: ['final', 'terlambat'] } };

  const tagihanList = await Tagihan.findAll({
    where,
    include: [
      { model: Pelanggan, as: 'pelanggan', where: kategori_id ? { kategori_id } : undefined },
    ],
    order: [[{ model: Pelanggan, as: 'pelanggan' }, 'nama', 'ASC']],
  });

  if (doExport === 'excel') {
    return exportTunggakanExcel(res, tagihanList);
  }

  const total = tagihanList.reduce((s, t) => s + parseFloat(t.total_tagihan || 0), 0);
  const kategoriList = await KategoriPelanggan.findAll();
  res.render('laporan/tunggakan', { currentPage: 'laporan', tagihanList, total, kategoriList, kategori_id });
});

// Laporan pembayaran
router.get('/pembayaran', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'kasir'), async (req, res) => {
  const { dari, sampai, export: doExport } = req.query;
  const where = {};
  if (dari && sampai) where.tanggal_bayar = { [Op.between]: [dari, sampai] };
  else if (dari) where.tanggal_bayar = { [Op.gte]: dari };

  const pembayaranList = await Pembayaran.findAll({
    where,
    include: [{ model: Pelanggan, as: 'pelanggan' }, { model: Tagihan, as: 'tagihan' }],
    order: [['tanggal_bayar', 'DESC']],
  });

  if (doExport === 'excel') {
    return exportPembayaranExcel(res, pembayaranList);
  }

  const total = pembayaranList.reduce((s, p) => s + parseFloat(p.jumlah_bayar || 0), 0);
  res.render('laporan/pembayaran', { currentPage: 'laporan', pembayaranList, total, dari, sampai });
});

// Laporan pelanggan
router.get('/pelanggan', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  const { export: doExport } = req.query;
  const pelangganList = await Pelanggan.findAll({
    include: [{ model: KategoriPelanggan, as: 'kategori' }, { model: Rute, as: 'rute' }],
    order: [['no_pelanggan', 'ASC']],
  });

  if (doExport === 'excel') {
    return exportPelangganExcel(res, pelangganList);
  }

  res.render('laporan/pelanggan', { currentPage: 'laporan', pelangganList });
});

// Laporan tagihan per periode
router.get('/tagihan', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer', 'kasir'), async (req, res) => {
  const { periode_id, export: doExport } = req.query;
  const where = {};
  if (periode_id) where.periode_id = periode_id;

  const tagihanList = await Tagihan.findAll({
    where,
    include: [{ model: Pelanggan, as: 'pelanggan' }, { model: PeriodeBaca, as: 'periode' }],
    order: [['createdAt', 'DESC']],
  });

  if (doExport === 'excel') {
    return exportTagihanExcel(res, tagihanList);
  }

  const periodeList = await PeriodeBaca.findAll({ order: [['tahun', 'DESC'], ['bulan', 'DESC']] });
  const summary = {
    total: tagihanList.reduce((s, t) => s + parseFloat(t.total_tagihan || 0), 0),
    lunas: tagihanList.filter(t => t.status === 'lunas').reduce((s, t) => s + parseFloat(t.total_tagihan || 0), 0),
    belum: tagihanList.filter(t => t.status !== 'lunas' && t.status !== 'dibatalkan').reduce((s, t) => s + parseFloat(t.total_tagihan || 0), 0),
  };

  res.render('laporan/tagihan', { currentPage: 'laporan', tagihanList, periodeList, summary, periode_id });
});

// === Excel Export Helpers ===
function headerStyle(wb) {
  return wb.createStyle({ font: { bold: true, size: 11 }, fill: { type: 'pattern', patternType: 'solid', fgColor: '1E3A5F' }, font: { color: 'FFFFFF', bold: true } });
}

function exportTunggakanExcel(res, data) {
  const wb = new xl.Workbook();
  const ws = wb.addWorksheet('Tunggakan');
  const hs = wb.createStyle({ font: { bold: true, color: 'FFFFFF' }, fill: { type: 'pattern', patternType: 'solid', fgColor: '1E3A5F' } });
  const heads = ['No Pelanggan', 'Nama', 'No Tagihan', 'Periode', 'Total Tagihan', 'Status'];
  heads.forEach((h, i) => ws.cell(1, i + 1).string(h).style(hs));
  data.forEach((t, i) => {
    const r = i + 2;
    ws.cell(r, 1).string(t.pelanggan?.no_pelanggan || '');
    ws.cell(r, 2).string(t.pelanggan?.nama || '');
    ws.cell(r, 3).string(t.no_tagihan || '');
    ws.cell(r, 4).string(t.periode?.nama_periode || '');
    ws.cell(r, 5).number(parseFloat(t.total_tagihan || 0));
    ws.cell(r, 6).string(t.status);
  });
  res.setHeader('Content-Disposition', 'attachment; filename=laporan_tunggakan.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  wb.write('tunggakan.xlsx', res);
}

function exportPembayaranExcel(res, data) {
  const wb = new xl.Workbook();
  const ws = wb.addWorksheet('Pembayaran');
  const hs = wb.createStyle({ font: { bold: true, color: 'FFFFFF' }, fill: { type: 'pattern', patternType: 'solid', fgColor: '1E3A5F' } });
  ['No Pembayaran', 'No Pelanggan', 'Nama', 'Tanggal Bayar', 'Jumlah', 'Metode'].forEach((h, i) => ws.cell(1, i + 1).string(h).style(hs));
  data.forEach((p, i) => {
    const r = i + 2;
    ws.cell(r, 1).string(p.no_pembayaran || '');
    ws.cell(r, 2).string(p.pelanggan?.no_pelanggan || '');
    ws.cell(r, 3).string(p.pelanggan?.nama || '');
    ws.cell(r, 4).string(p.tanggal_bayar ? String(p.tanggal_bayar) : '');
    ws.cell(r, 5).number(parseFloat(p.jumlah_bayar || 0));
    ws.cell(r, 6).string(p.metode || '');
  });
  res.setHeader('Content-Disposition', 'attachment; filename=laporan_pembayaran.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  wb.write('pembayaran.xlsx', res);
}

function exportPelangganExcel(res, data) {
  const wb = new xl.Workbook();
  const ws = wb.addWorksheet('Pelanggan');
  const hs = wb.createStyle({ font: { bold: true, color: 'FFFFFF' }, fill: { type: 'pattern', patternType: 'solid', fgColor: '1E3A5F' } });
  ['No Pelanggan', 'No Sambungan', 'Nama', 'Alamat', 'No HP', 'Kategori', 'Status', 'Rute'].forEach((h, i) => ws.cell(1, i + 1).string(h).style(hs));
  data.forEach((p, i) => {
    const r = i + 2;
    ws.cell(r, 1).string(p.no_pelanggan || '');
    ws.cell(r, 2).string(p.no_sambungan || '');
    ws.cell(r, 3).string(p.nama || '');
    ws.cell(r, 4).string(p.alamat || '');
    ws.cell(r, 5).string(p.no_hp || '');
    ws.cell(r, 6).string(p.kategori?.nama || '');
    ws.cell(r, 7).string(p.status || '');
    ws.cell(r, 8).string(p.rute?.nama_rute || '');
  });
  res.setHeader('Content-Disposition', 'attachment; filename=laporan_pelanggan.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  wb.write('pelanggan.xlsx', res);
}

function exportTagihanExcel(res, data) {
  const wb = new xl.Workbook();
  const ws = wb.addWorksheet('Tagihan');
  const hs = wb.createStyle({ font: { bold: true, color: 'FFFFFF' }, fill: { type: 'pattern', patternType: 'solid', fgColor: '1E3A5F' } });
  ['No Tagihan', 'No Pelanggan', 'Nama', 'Periode', 'Pemakaian', 'Total Tagihan', 'Status'].forEach((h, i) => ws.cell(1, i + 1).string(h).style(hs));
  data.forEach((t, i) => {
    const r = i + 2;
    ws.cell(r, 1).string(t.no_tagihan || '');
    ws.cell(r, 2).string(t.pelanggan?.no_pelanggan || '');
    ws.cell(r, 3).string(t.pelanggan?.nama || '');
    ws.cell(r, 4).string(t.periode?.nama_periode || '');
    ws.cell(r, 5).number(parseFloat(t.pemakaian || 0));
    ws.cell(r, 6).number(parseFloat(t.total_tagihan || 0));
    ws.cell(r, 7).string(t.status || '');
  });
  res.setHeader('Content-Disposition', 'attachment; filename=laporan_tagihan.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  wb.write('tagihan.xlsx', res);
}

module.exports = router;
