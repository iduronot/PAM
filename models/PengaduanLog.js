const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PengaduanLog = sequelize.define('PengaduanLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  pengaduan_id: { type: DataTypes.INTEGER, allowNull: false },
  status_lama: { type: DataTypes.STRING(50) },
  status_baru: { type: DataTypes.STRING(50), allowNull: false },
  catatan: { type: DataTypes.TEXT },
  user_id: { type: DataTypes.INTEGER },
}, {
  tableName: 'pengaduan_log',
  timestamps: true,
  updatedAt: false,
});

module.exports = PengaduanLog;
