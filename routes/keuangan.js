const express = require('express');
const router = express.Router();
const { requireLogin, requireNotPelanggan } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { Tagihan, Pembayaran, Pengeluaran, Pemasukan, Pelanggan } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const xl = require('excel4node');

const LABEL_KATEGORI_PENGELUARAN = {
  operasional: 'Operasional', pemeliharaan: 'Pemeliharaan', gaji: 'Gaji/Honor',
  utilitas: 'Listrik/Air/Internet', perlengkapan: 'Perlengkapan', lain_lain: 'Lain-lain',
};
const LABEL_KATEGORI_PEMASUKAN = {
  hibah_desa: 'Hibah Desa', hibah_kecamatan: 'Hibah Kecamatan',
  hibah_pemerintah: 'Hibah Pemerintah', donasi: 'Donasi',
  retribusi: 'Retribusi', lain_lain: 'Lain-lain',
};

const WARNA_PENGELUARAN = {
  operasional: '#0ea5e9', pemeliharaan: '#f59e0b', gaji: '#10b981',
  utilitas: '#8b5cf6', perlengkapan: '#ec4899', lain_lain: '#94a3b8',
};

router.get('/', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  try {
    const now = new Date();
    const bulan = parseInt(req.query.bulan) || now.getMonth() + 1;
    const tahun = parseInt(req.query.tahun) || now.getFullYear();
    const awalBulan = new Date(tahun, bulan - 1, 1);
    const awalBulanDepan = new Date(tahun, bulan, 1);
    const awalStr = awalBulan.toISOString().slice(0, 10);
    const akhirStr = awalBulanDepan.toISOString().slice(0, 10);

    const whereLunasBulan = { status: 'lunas', createdAt: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } };
    const whereLunasAll  = { status: 'lunas' };
    const whereTagihanBulan = { status: { [Op.in]: ['final', 'lunas', 'terlambat'] }, createdAt: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } };

    const [
      // Komponen tagihan lunas bulan ini
      bebanAdminBulan, bebanMinimumBulan, subtotalAirBulan, kubikBulan,
      // Komponen tagihan lunas all-time
      bebanAdminTotal, bebanMinimumTotal, subtotalAirTotal, kubikTotal,
      // Pembayaran (iuran air diterima)
      iuranAirBulan, iuranAirTotal,
      // Pemasukan lain (hibah)
      hibahBulan, hibahTotal,
      // Pengeluaran
      pengeluaranBulanTotal, pengeluaranAllTotal,
      // Tagihan overview bulan
      totalTagihanBulan, totalLunasBulan,
      // Pelanggan
      totalPelangganAktif,
    ] = await Promise.all([
      Tagihan.sum('biaya_admin',   { where: whereLunasBulan }),
      Tagihan.sum('biaya_minimum', { where: whereLunasBulan }),
      Tagihan.sum('subtotal_air',  { where: whereLunasBulan }),
      Tagihan.sum('pemakaian',     { where: whereTagihanBulan }),
      Tagihan.sum('biaya_admin',   { where: whereLunasAll }),
      Tagihan.sum('biaya_minimum', { where: whereLunasAll }),
      Tagihan.sum('subtotal_air',  { where: whereLunasAll }),
      Tagihan.sum('pemakaian',     { where: { status: { [Op.in]: ['final', 'lunas', 'terlambat'] } } }),
      Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } } }),
      Pembayaran.sum('jumlah_bayar'),
      Pemasukan.sum('jumlah', { where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } } }),
      Pemasukan.sum('jumlah'),
      Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } } }),
      Pengeluaran.sum('jumlah'),
      Tagihan.sum('total_tagihan', { where: whereTagihanBulan }),
      Tagihan.sum('total_tagihan', { where: { status: 'lunas', createdAt: { [Op.gte]: awalBulan, [Op.lt]: awalBulanDepan } } }),
      Pelanggan.count({ where: { status: 'aktif' } }),
    ]);

    // Ringkasan bulan ini
    const bebanBulananBulan = (bebanAdminBulan || 0) + (bebanMinimumBulan || 0);
    const bebanBulananTotal = (bebanAdminTotal || 0) + (bebanMinimumTotal || 0);
    const totalMasukBulan   = (iuranAirBulan || 0) + (hibahBulan || 0);
    const totalMasukAll     = (iuranAirTotal || 0) + (hibahTotal || 0);
    const saldoBulan        = totalMasukBulan - (pengeluaranBulanTotal || 0);
    const saldoTotal        = totalMasukAll - (pengeluaranAllTotal || 0);

    // Pengeluaran per kategori bulan ini
    const pengeluaranPerKategori = await Pengeluaran.findAll({
      attributes: ['kategori', [sequelize.fn('SUM', sequelize.col('jumlah')), 'total'], [sequelize.fn('COUNT', sequelize.col('id')), 'jumlah_transaksi']],
      where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } },
      group: ['kategori'],
      order: [[sequelize.fn('SUM', sequelize.col('jumlah')), 'DESC']],
      raw: true,
    });

    // Pengeluaran per sumber dana bulan ini
    const pengeluaranPerSumber = await Pengeluaran.findAll({
      attributes: ['sumber_dana', [sequelize.fn('SUM', sequelize.col('jumlah')), 'total']],
      where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } },
      group: ['sumber_dana'],
      raw: true,
    });
    const kelMap = {};
    pengeluaranPerSumber.forEach(r => { kelMap[r.sumber_dana || '__lain'] = parseFloat(r.total) || 0; });
    const keluarAbodemenBulan  = kelMap['abodemen']      || 0;
    const keluarAirBulan       = kelMap['pemakaian_air'] || 0;
    const keluarHibahBulan     = kelMap['hibah']         || 0;
    const keluarLainBulan      = kelMap['__lain']        || 0;

    // Detail pengeluaran bulan ini (10 teratas)
    const pengeluaranDetail = await Pengeluaran.findAll({
      where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } },
      order: [['jumlah', 'DESC']],
      limit: 15,
    });

    // Detail pemasukan lain bulan ini
    const pemasukanDetail = await Pemasukan.findAll({
      where: { tanggal: { [Op.gte]: awalStr, [Op.lt]: akhirStr } },
      order: [['jumlah', 'DESC']],
    });

    // Tren 6 bulan
    const NAMA_BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const tren = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(tahun, bulan - 1 - i, 1);
      const bln = d.getMonth() + 1;
      const thn = d.getFullYear();
      const awal = new Date(thn, bln - 1, 1);
      const akhir = new Date(thn, bln, 1);
      const awalS = awal.toISOString().slice(0, 10);
      const akhirS = akhir.toISOString().slice(0, 10);
      const lWhere = { status: 'lunas', createdAt: { [Op.gte]: awal, [Op.lt]: akhir } };
      const [bAdmin, bMin, sAir, bayar, hibah, keluar] = await Promise.all([
        Tagihan.sum('biaya_admin',   { where: lWhere }),
        Tagihan.sum('biaya_minimum', { where: lWhere }),
        Tagihan.sum('subtotal_air',  { where: lWhere }),
        Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awal, [Op.lt]: akhir } } }),
        Pemasukan.sum('jumlah', { where: { tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
        Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
      ]);
      tren.push({
        label: `${NAMA_BULAN[bln - 1]} ${thn}`,
        beban: (bAdmin || 0) + (bMin || 0),
        air: sAir || 0,
        hibah: hibah || 0,
        masuk: (bayar || 0) + (hibah || 0),
        keluar: keluar || 0,
      });
    }

    res.render('keuangan/index', {
      currentPage: 'keuangan',
      bulan, tahun,
      bulanNow: now.getMonth() + 1, tahunNow: now.getFullYear(),
      // Komponen tagihan
      bebanBulananBulan, bebanBulananTotal,
      subtotalAirBulan: subtotalAirBulan || 0,
      subtotalAirTotal: subtotalAirTotal || 0,
      kubikBulan: parseFloat(kubikBulan || 0),
      kubikTotal: parseFloat(kubikTotal || 0),
      // Kas masuk
      iuranAirBulan: iuranAirBulan || 0,
      iuranAirTotal: iuranAirTotal || 0,
      hibahBulan: hibahBulan || 0,
      hibahTotal: hibahTotal || 0,
      totalMasukBulan, totalMasukAll,
      // Pengeluaran
      pengeluaranBulanTotal: pengeluaranBulanTotal || 0,
      pengeluaranAllTotal: pengeluaranAllTotal || 0,
      // Tagihan overview
      totalTagihanBulan: totalTagihanBulan || 0,
      totalLunasBulan: totalLunasBulan || 0,
      totalPelangganAktif,
      // Saldo
      saldoBulan, saldoTotal,
      // Detail
      pengeluaranPerKategori,
      pengeluaranDetail,
      pemasukanDetail,
      keluarAbodemenBulan, keluarAirBulan, keluarHibahBulan, keluarLainBulan,
      LABEL_KATEGORI_PENGELUARAN,
      LABEL_KATEGORI_PEMASUKAN,
      WARNA_PENGELUARAN,
      tren: JSON.stringify(tren),
    });
  } catch (e) {
    console.error(e);
    req.flash('error', 'Gagal memuat ringkasan keuangan');
    res.redirect('/dashboard');
  }
});

// GET /keuangan/tabel — tabel ringkasan per bulan
router.get('/tabel', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  try {
    const now = new Date();
    const tahun = parseInt(req.query.tahun) || now.getFullYear();

    const NAMA_BULAN_PANJANG = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    const tabelBulanan = [];
    for (let bln = 1; bln <= 12; bln++) {
      const awal  = new Date(tahun, bln - 1, 1);
      const akhir = new Date(tahun, bln, 1);
      const awalS  = awal.toISOString().slice(0, 10);
      const akhirS = akhir.toISOString().slice(0, 10);
      const lWhere = { status: 'lunas', createdAt: { [Op.gte]: awal, [Op.lt]: akhir } };
      const [bAdmin, bMin, sAir, kubik, bayar, hibahM, keluar, kAbodemen, kAir, kHibah] = await Promise.all([
        Tagihan.sum('biaya_admin',   { where: lWhere }),
        Tagihan.sum('biaya_minimum', { where: lWhere }),
        Tagihan.sum('subtotal_air',  { where: lWhere }),
        Tagihan.sum('pemakaian',     { where: { status: { [Op.in]: ['final','lunas','terlambat'] }, createdAt: { [Op.gte]: awal, [Op.lt]: akhir } } }),
        Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awal, [Op.lt]: akhir } } }),
        Pemasukan.sum('jumlah',   { where: { tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
        Pengeluaran.sum('jumlah', { where: { tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
        Pengeluaran.sum('jumlah', { where: { sumber_dana: 'abodemen',      tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
        Pengeluaran.sum('jumlah', { where: { sumber_dana: 'pemakaian_air', tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
        Pengeluaran.sum('jumlah', { where: { sumber_dana: 'hibah',         tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
      ]);
      const beban = (bAdmin || 0) + (bMin || 0);
      const masuk = (bayar  || 0) + (hibahM || 0);
      const out   = keluar  || 0;
      tabelBulanan.push({
        bulan: bln,
        namaBulan: NAMA_BULAN_PANJANG[bln - 1],
        bebanBulanan: beban,
        biayaAir: sAir || 0,
        kubik: parseFloat(kubik || 0),
        hibah: hibahM || 0,
        totalMasuk: masuk,
        pengeluaran: out,
        keluarAbodemen: kAbodemen || 0,
        keluarAir: kAir || 0,
        keluarHibah: kHibah || 0,
        keluarLain: out - (kAbodemen||0) - (kAir||0) - (kHibah||0),
        saldo: masuk - out,
        adaData: masuk > 0 || out > 0,
      });
    }

    // Daftar tahun yang tersedia (dari tagihan pertama hingga sekarang)
    const tahunList = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) tahunList.push(y);

    res.render('keuangan/tabel', {
      currentPage: 'keuangan_tabel',
      tahun, tahunNow: now.getFullYear(),
      tahunList,
      tabelBulanan,
    });
  } catch (e) {
    console.error(e);
    req.flash('error', 'Gagal memuat tabel keuangan');
    res.redirect('/keuangan');
  }
});

// Helper: ambil data bulanan (dipakai /tabel dan /tabel/export)
async function getTabelBulanan(tahun) {
  const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const rows = [];
  for (let bln = 1; bln <= 12; bln++) {
    const awal  = new Date(tahun, bln - 1, 1);
    const akhir = new Date(tahun, bln, 1);
    const awalS  = awal.toISOString().slice(0, 10);
    const akhirS = akhir.toISOString().slice(0, 10);
    const lWhere = { status: 'lunas', createdAt: { [Op.gte]: awal, [Op.lt]: akhir } };
    const [bAdmin, bMin, sAir, kubik, bayar, hibahM, keluar, kAbodemen, kAir, kHibah] = await Promise.all([
      Tagihan.sum('biaya_admin',   { where: lWhere }),
      Tagihan.sum('biaya_minimum', { where: lWhere }),
      Tagihan.sum('subtotal_air',  { where: lWhere }),
      Tagihan.sum('pemakaian',     { where: { status: { [Op.in]: ['final','lunas','terlambat'] }, createdAt: { [Op.gte]: awal, [Op.lt]: akhir } } }),
      Pembayaran.sum('jumlah_bayar', { where: { tanggal_bayar: { [Op.gte]: awal, [Op.lt]: akhir } } }),
      Pemasukan.sum('jumlah',    { where: { tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
      Pengeluaran.sum('jumlah',  { where: { tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
      Pengeluaran.sum('jumlah',  { where: { sumber_dana: 'abodemen',      tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
      Pengeluaran.sum('jumlah',  { where: { sumber_dana: 'pemakaian_air', tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
      Pengeluaran.sum('jumlah',  { where: { sumber_dana: 'hibah',         tanggal: { [Op.gte]: awalS, [Op.lt]: akhirS } } }),
    ]);
    const beban = (bAdmin||0) + (bMin||0);
    const masuk = (bayar||0)  + (hibahM||0);
    const out   = keluar || 0;
    rows.push({
      namaBulan: NAMA_BULAN[bln - 1],
      bebanBulanan: beban,
      biayaAir: sAir || 0,
      kubik: parseFloat(kubik || 0),
      hibah: hibahM || 0,
      totalMasuk: masuk,
      pengeluaran: out,
      keluarAbodemen: kAbodemen || 0,
      keluarAir: kAir || 0,
      keluarHibah: kHibah || 0,
      saldo: masuk - out,
    });
  }
  return rows;
}

// GET /keuangan/tabel/export
router.get('/tabel/export', requireLogin, requireRole('super_admin', 'admin_pam', 'manajer'), async (req, res) => {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const data  = await getTabelBulanan(tahun);

    const wb = new xl.Workbook({ defaultFont: { name: 'Calibri', size: 11 } });

    // ── Styles ──────────────────────────────────────────────────
    const sTitle = wb.createStyle({ font: { bold: true, size: 13 }, alignment: { horizontal: 'left' } });
    const sHead  = (hex) => wb.createStyle({
      font: { bold: true, color: '#FFFFFF', size: 10 },
      fill: { type: 'pattern', patternType: 'solid', fgColor: hex },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { left:{style:'thin',color:'#FFFFFF'}, right:{style:'thin',color:'#FFFFFF'} },
    });
    const sRp    = wb.createStyle({ numberFormat: '#,##0', alignment: { horizontal: 'right' } });
    const sRpBold= wb.createStyle({ numberFormat: '#,##0', alignment: { horizontal: 'right' }, font: { bold: true } });
    const sMuted = wb.createStyle({ font: { color: '#888888' }, alignment: { horizontal: 'center' } });
    const sTot   = (hex) => wb.createStyle({ font: { bold: true, color: hex }, numberFormat: '#,##0', alignment: { horizontal: 'right' }, fill: { type:'pattern', patternType:'solid', fgColor:'#F0F4F8' } });
    const sBulan = wb.createStyle({ font: { bold: true } });

    const totals = data.reduce((acc, r) => {
      acc.beban  += r.bebanBulanan; acc.air  += r.biayaAir;  acc.kubik += r.kubik;
      acc.hibah  += r.hibah;        acc.masuk += r.totalMasuk;
      acc.keluar += r.pengeluaran;  acc.saldo += r.saldo;
      acc.kAbodemen += r.keluarAbodemen; acc.kAir += r.keluarAir; acc.kHibah += r.keluarHibah;
      return acc;
    }, { beban:0, air:0, kubik:0, hibah:0, masuk:0, keluar:0, saldo:0, kAbodemen:0, kAir:0, kHibah:0 });

    // ── Sheet 1: Pemasukan ──────────────────────────────────────
    const ws1 = wb.addWorksheet('Pemasukan');
    ws1.column(1).setWidth(5);  ws1.column(2).setWidth(18);
    ws1.column(3).setWidth(18); ws1.column(4).setWidth(20);
    ws1.column(5).setWidth(12); ws1.column(6).setWidth(18); ws1.column(7).setWidth(18);

    ws1.cell(1,1,1,7,true).string(`Rekap Pemasukan ${tahun}`).style(sTitle);
    const h1 = sHead('#1e40af');
    ['No','Bulan','Beban Bulanan (Rp)','Biaya Pemakaian Air (Rp)','Kubik (m³)','Hibah / Donasi (Rp)','Total Masuk (Rp)']
      .forEach((t,i) => ws1.cell(2, i+1).string(t).style(h1));

    data.forEach((r, i) => {
      const row = i + 3;
      ws1.cell(row,1).number(i+1).style(sMuted);
      ws1.cell(row,2).string(r.namaBulan).style(sBulan);
      r.bebanBulanan > 0 ? ws1.cell(row,3).number(r.bebanBulanan).style(sRp) : ws1.cell(row,3).string('—').style(sMuted);
      r.biayaAir     > 0 ? ws1.cell(row,4).number(r.biayaAir).style(sRp)     : ws1.cell(row,4).string('—').style(sMuted);
      ws1.cell(row,5).number(r.kubik).style(wb.createStyle({ numberFormat: '#,##0.00', alignment:{horizontal:'right'} }));
      r.hibah        > 0 ? ws1.cell(row,6).number(r.hibah).style(sRp)        : ws1.cell(row,6).string('—').style(sMuted);
      r.totalMasuk   > 0 ? ws1.cell(row,7).number(r.totalMasuk).style(sRpBold): ws1.cell(row,7).string('—').style(sMuted);
    });
    const tf1 = 15;
    ws1.cell(tf1,1,tf1,2,true).string(`Total ${tahun}`).style(wb.createStyle({ font:{bold:true} }));
    ws1.cell(tf1,3).number(totals.beban).style(sTot('#1e40af'));
    ws1.cell(tf1,4).number(totals.air).style(sTot('#15803d'));
    ws1.cell(tf1,5).number(totals.kubik).style(sTot('#555555'));
    ws1.cell(tf1,6).number(totals.hibah).style(sTot('#6d28d9'));
    ws1.cell(tf1,7).number(totals.masuk).style(sTot('#15803d'));

    // ── Sheet 2: Pengeluaran per Dana ───────────────────────────
    const ws2 = wb.addWorksheet('Pengeluaran per Dana');
    ws2.column(1).setWidth(5);  ws2.column(2).setWidth(18);
    ws2.column(3).setWidth(18); ws2.column(4).setWidth(20);
    ws2.column(5).setWidth(15); ws2.column(6).setWidth(18); ws2.column(7).setWidth(15);

    ws2.cell(1,1,1,7,true).string(`Rekap Pengeluaran per Dana ${tahun}`).style(sTitle);
    const h2 = sHead('#991b1b');
    ['No','Bulan','Dari Abodemen (Rp)','Dari Pemakaian Air (Rp)','Dari Hibah (Rp)','Total Keluar (Rp)','Saldo (Rp)']
      .forEach((t,i) => ws2.cell(2, i+1).string(t).style(h2));

    data.forEach((r, i) => {
      const row = i + 3;
      ws2.cell(row,1).number(i+1).style(sMuted);
      ws2.cell(row,2).string(r.namaBulan).style(sBulan);
      r.keluarAbodemen > 0 ? ws2.cell(row,3).number(r.keluarAbodemen).style(sRp) : ws2.cell(row,3).string('—').style(sMuted);
      r.keluarAir      > 0 ? ws2.cell(row,4).number(r.keluarAir).style(sRp)      : ws2.cell(row,4).string('—').style(sMuted);
      r.keluarHibah    > 0 ? ws2.cell(row,5).number(r.keluarHibah).style(sRp)    : ws2.cell(row,5).string('—').style(sMuted);
      r.pengeluaran    > 0 ? ws2.cell(row,6).number(r.pengeluaran).style(sRpBold) : ws2.cell(row,6).string('—').style(sMuted);
      const sc = r.saldo >= 0 ? '#15803d' : '#dc2626';
      (r.totalMasuk > 0 || r.pengeluaran > 0)
        ? ws2.cell(row,7).number(r.saldo).style(wb.createStyle({ numberFormat:'#,##0', alignment:{horizontal:'right'}, font:{bold:true,color:sc} }))
        : ws2.cell(row,7).string('—').style(sMuted);
    });
    const tf2 = 15;
    ws2.cell(tf2,1,tf2,2,true).string(`Total ${tahun}`).style(wb.createStyle({ font:{bold:true} }));
    ws2.cell(tf2,3).number(totals.kAbodemen).style(sTot('#1e40af'));
    ws2.cell(tf2,4).number(totals.kAir).style(sTot('#15803d'));
    ws2.cell(tf2,5).number(totals.kHibah).style(sTot('#6d28d9'));
    ws2.cell(tf2,6).number(totals.keluar).style(sTot('#dc2626'));
    ws2.cell(tf2,7).number(totals.saldo).style(sTot(totals.saldo >= 0 ? '#15803d' : '#dc2626'));

    // ── Sheet 3: Sisa Dana ──────────────────────────────────────
    const ws3 = wb.addWorksheet('Sisa Dana');
    ws3.column(1).setWidth(5);  ws3.column(2).setWidth(18);
    ws3.column(3).setWidth(18); ws3.column(4).setWidth(20);
    ws3.column(5).setWidth(15); ws3.column(6).setWidth(18);

    ws3.cell(1,1,1,6,true).string(`Rekap Sisa Dana ${tahun}`).style(sTitle);
    const h3 = sHead('#065f46');
    ['No','Bulan','Sisa Abodemen (Rp)','Sisa Pemakaian Air (Rp)','Sisa Hibah (Rp)','Total Sisa (Rp)']
      .forEach((t,i) => ws3.cell(2, i+1).string(t).style(h3));

    data.forEach((r, i) => {
      const row = i + 3;
      const sA = r.bebanBulanan - r.keluarAbodemen;
      const sW = r.biayaAir    - r.keluarAir;
      const sH = r.hibah       - r.keluarHibah;
      const sT = sA + sW + sH;
      ws3.cell(row,1).number(i+1).style(sMuted);
      ws3.cell(row,2).string(r.namaBulan).style(sBulan);
      const mkSisa = (v) => wb.createStyle({ numberFormat:'#,##0', alignment:{horizontal:'right'}, font:{color: v>=0?'#15803d':'#dc2626'} });
      ws3.cell(row,3).number(sA).style(mkSisa(sA));
      ws3.cell(row,4).number(sW).style(mkSisa(sW));
      ws3.cell(row,5).number(sH).style(mkSisa(sH));
      ws3.cell(row,6).number(sT).style(wb.createStyle({ numberFormat:'#,##0', alignment:{horizontal:'right'}, font:{bold:true, color:sT>=0?'#15803d':'#dc2626'} }));
    });
    const tf3 = 15;
    const totSA = totals.beban - totals.kAbodemen;
    const totSW = totals.air   - totals.kAir;
    const totSH = totals.hibah - totals.kHibah;
    const totST = totals.saldo;
    ws3.cell(tf3,1,tf3,2,true).string(`Total ${tahun}`).style(wb.createStyle({ font:{bold:true} }));
    ws3.cell(tf3,3).number(totSA).style(sTot(totSA>=0?'#15803d':'#dc2626'));
    ws3.cell(tf3,4).number(totSW).style(sTot(totSW>=0?'#15803d':'#dc2626'));
    ws3.cell(tf3,5).number(totSH).style(sTot(totSH>=0?'#6d28d9':'#dc2626'));
    ws3.cell(tf3,6).number(totST).style(sTot(totST>=0?'#15803d':'#dc2626'));

    const filename = `Rekap_Keuangan_${tahun}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    wb.write(filename, res);
  } catch (e) {
    console.error(e);
    req.flash('error', 'Gagal export Excel');
    res.redirect('/keuangan/tabel');
  }
});

module.exports = router;
