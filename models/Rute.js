const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Rute = sequelize.define('Rute', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nama_rute: { type: DataTypes.STRING(100), allowNull: false },
  deskripsi: { type: DataTypes.TEXT },
  urutan: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'rute',
  timestamps: true,
});

module.exports = Rute;
