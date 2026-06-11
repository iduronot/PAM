const sequelize = require('../config/database');
const User = require('./User');
const Rute = require('./Rute');
const KategoriPelanggan = require('./KategoriPelanggan');
const Pelanggan = require('./Pelanggan');
const Meter = require('./Meter');
const Tarif = require('./Tarif');
const PeriodeBaca = require('./PeriodeBaca');
const PencatatanMeter = require('./PencatatanMeter');
const Tagihan = require('./Tagihan');
const Pembayaran = require('./Pembayaran');
const Pengaduan = require('./Pengaduan');
const PengaduanLog = require('./PengaduanLog');
const AuditLog = require('./AuditLog');
const Pengeluaran = require('./Pengeluaran');
const AppSetting = require('./AppSetting');

// User - Pelanggan (untuk role pelanggan)
User.belongsTo(Pelanggan, { foreignKey: 'pelanggan_id', as: 'pelangganData' });
Pelanggan.hasOne(User, { foreignKey: 'pelanggan_id', as: 'userAccount' });

// Pelanggan - Kategori
Pelanggan.belongsTo(KategoriPelanggan, { foreignKey: 'kategori_id', as: 'kategori' });
KategoriPelanggan.hasMany(Pelanggan, { foreignKey: 'kategori_id', as: 'pelanggan' });

// Pelanggan - Rute
Pelanggan.belongsTo(Rute, { foreignKey: 'rute_id', as: 'rute' });
Rute.hasMany(Pelanggan, { foreignKey: 'rute_id', as: 'pelanggan' });

// Pelanggan - Meter
Meter.belongsTo(Pelanggan, { foreignKey: 'pelanggan_id', as: 'pelanggan' });
Pelanggan.hasMany(Meter, { foreignKey: 'pelanggan_id', as: 'meter' });

// Tarif - Kategori
Tarif.belongsTo(KategoriPelanggan, { foreignKey: 'kategori_id', as: 'kategori' });
KategoriPelanggan.hasMany(Tarif, { foreignKey: 'kategori_id', as: 'tarif' });

// PeriodeBaca
PencatatanMeter.belongsTo(PeriodeBaca, { foreignKey: 'periode_id', as: 'periode' });
PeriodeBaca.hasMany(PencatatanMeter, { foreignKey: 'periode_id', as: 'pencatatan' });

// PencatatanMeter - Pelanggan
PencatatanMeter.belongsTo(Pelanggan, { foreignKey: 'pelanggan_id', as: 'pelanggan' });
Pelanggan.hasMany(PencatatanMeter, { foreignKey: 'pelanggan_id', as: 'pencatatan' });

// PencatatanMeter - Meter
PencatatanMeter.belongsTo(Meter, { foreignKey: 'meter_id', as: 'meter' });
Meter.hasMany(PencatatanMeter, { foreignKey: 'meter_id', as: 'pencatatan' });

// PencatatanMeter - Petugas
PencatatanMeter.belongsTo(User, { foreignKey: 'petugas_id', as: 'petugas' });

// Tagihan
Tagihan.belongsTo(PeriodeBaca, { foreignKey: 'periode_id', as: 'periode' });
Tagihan.belongsTo(Pelanggan, { foreignKey: 'pelanggan_id', as: 'pelanggan' });
Tagihan.belongsTo(PencatatanMeter, { foreignKey: 'pencatatan_meter_id', as: 'pencatatanMeter' });
Tagihan.belongsTo(Tarif, { foreignKey: 'tarif_id', as: 'tarif' });
Tagihan.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });
Pelanggan.hasMany(Tagihan, { foreignKey: 'pelanggan_id', as: 'tagihan' });
PeriodeBaca.hasMany(Tagihan, { foreignKey: 'periode_id', as: 'tagihan' });

// Pembayaran
Pembayaran.belongsTo(Tagihan, { foreignKey: 'tagihan_id', as: 'tagihan' });
Pembayaran.belongsTo(Pelanggan, { foreignKey: 'pelanggan_id', as: 'pelanggan' });
Pembayaran.belongsTo(User, { foreignKey: 'kasir_id', as: 'kasir' });
Tagihan.hasMany(Pembayaran, { foreignKey: 'tagihan_id', as: 'pembayaran' });
Pelanggan.hasMany(Pembayaran, { foreignKey: 'pelanggan_id', as: 'pembayaran' });

// Pengaduan
Pengaduan.belongsTo(Pelanggan, { foreignKey: 'pelanggan_id', as: 'pelanggan' });
Pengaduan.belongsTo(User, { foreignKey: 'petugas_id', as: 'petugas' });
Pengaduan.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });
Pelanggan.hasMany(Pengaduan, { foreignKey: 'pelanggan_id', as: 'pengaduan' });
PengaduanLog.belongsTo(Pengaduan, { foreignKey: 'pengaduan_id', as: 'pengaduan' });
PengaduanLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Pengaduan.hasMany(PengaduanLog, { foreignKey: 'pengaduan_id', as: 'log' });

// AuditLog
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Pengeluaran
Pengeluaran.belongsTo(User, { foreignKey: 'created_by', as: 'pencatat' });

module.exports = {
  sequelize,
  User, Rute, KategoriPelanggan, Pelanggan, Meter,
  Tarif, PeriodeBaca, PencatatanMeter, Tagihan,
  Pembayaran, Pengaduan, PengaduanLog, AuditLog, Pengeluaran, AppSetting,
};
