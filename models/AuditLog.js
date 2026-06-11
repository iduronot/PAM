const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER },
  aksi: { type: DataTypes.STRING(100), allowNull: false },
  tabel_nama: { type: DataTypes.STRING(100) },
  record_id: { type: DataTypes.INTEGER },
  data_lama: { type: DataTypes.TEXT },
  data_baru: { type: DataTypes.TEXT },
  ip_address: { type: DataTypes.STRING(50) },
  keterangan: { type: DataTypes.TEXT },
}, {
  tableName: 'audit_log',
  timestamps: true,
  updatedAt: false,
});

module.exports = AuditLog;
