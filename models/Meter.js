const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Meter = sequelize.define('Meter', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  pelanggan_id: { type: DataTypes.INTEGER, allowNull: false },
  no_meter: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  tanggal_pasang: { type: DataTypes.DATEONLY },
  merk: { type: DataTypes.STRING(100) },
  diameter: { type: DataTypes.STRING(20) },
  status: {
    type: DataTypes.ENUM('aktif', 'rusak', 'diganti', 'dicabut'),
    defaultValue: 'aktif',
  },
  angka_awal: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  foto_awal: { type: DataTypes.STRING(255) },
  catatan_teknis: { type: DataTypes.TEXT },
}, {
  tableName: 'meter',
  timestamps: true,
});

module.exports = Meter;
