const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PencatatanMeter = sequelize.define('PencatatanMeter', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  periode_id: { type: DataTypes.INTEGER, allowNull: false },
  pelanggan_id: { type: DataTypes.INTEGER, allowNull: false },
  meter_id: { type: DataTypes.INTEGER, allowNull: false },
  angka_sebelumnya: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  angka_sekarang: { type: DataTypes.DECIMAL(10, 2) },
  pemakaian: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  foto_meter: { type: DataTypes.STRING(255) },
  petugas_id: { type: DataTypes.INTEGER },
  tanggal_baca: { type: DataTypes.DATE },
  lokasi_gps: { type: DataTypes.STRING(100) },
  status: {
    type: DataTypes.ENUM('belum_dibaca', 'terbaca', 'tidak_dapat_diakses', 'meter_rusak', 'rumah_kosong', 'anomali'),
    defaultValue: 'belum_dibaca',
  },
  catatan: { type: DataTypes.TEXT },
  status_verifikasi: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    defaultValue: 'pending',
  },
  verified_by: { type: DataTypes.INTEGER },
  verified_at: { type: DataTypes.DATE },
}, {
  tableName: 'pencatatan_meter',
  timestamps: true,
});

module.exports = PencatatanMeter;
