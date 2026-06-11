const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PeriodeBaca = sequelize.define('PeriodeBaca', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nama_periode: { type: DataTypes.STRING(50), allowNull: false },
  bulan: { type: DataTypes.INTEGER, allowNull: false },
  tahun: { type: DataTypes.INTEGER, allowNull: false },
  tanggal_mulai: { type: DataTypes.DATEONLY },
  tanggal_selesai: { type: DataTypes.DATEONLY },
  tanggal_jatuh_tempo: { type: DataTypes.DATEONLY },
  status: {
    type: DataTypes.ENUM('buka', 'tutup', 'selesai'),
    defaultValue: 'buka',
  },
}, {
  tableName: 'periode_baca',
  timestamps: true,
});

module.exports = PeriodeBaca;
