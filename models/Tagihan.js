const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tagihan = sequelize.define('Tagihan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  no_tagihan: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  periode_id: { type: DataTypes.INTEGER, allowNull: false },
  pelanggan_id: { type: DataTypes.INTEGER, allowNull: false },
  pencatatan_meter_id: { type: DataTypes.INTEGER },
  pemakaian: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  tarif_id: { type: DataTypes.INTEGER },
  harga_per_m3: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  subtotal_air: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  biaya_admin: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  biaya_minimum: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  denda: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  penyesuaian: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_tagihan: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  tanggal_jatuh_tempo: { type: DataTypes.DATEONLY },
  status: {
    type: DataTypes.ENUM('draft', 'final', 'lunas', 'terlambat', 'dibatalkan'),
    defaultValue: 'draft',
  },
  catatan_koreksi: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER },
}, {
  tableName: 'tagihan',
  timestamps: true,
});

module.exports = Tagihan;
