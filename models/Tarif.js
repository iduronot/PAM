const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tarif = sequelize.define('Tarif', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nama_tarif: { type: DataTypes.STRING(100), allowNull: false },
  kategori_id: { type: DataTypes.INTEGER },
  harga_per_m3: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  biaya_admin: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  biaya_minimum: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  minimum_m3: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: 'Minimum pemakaian m3 yang dikenakan tarif minimum' },
  denda_persen: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0, comment: 'Persen denda keterlambatan dari total tagihan' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  tanggal_berlaku: { type: DataTypes.DATEONLY },
}, {
  tableName: 'tarif',
  timestamps: true,
});

module.exports = Tarif;
