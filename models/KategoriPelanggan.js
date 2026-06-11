const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const KategoriPelanggan = sequelize.define('KategoriPelanggan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nama: { type: DataTypes.STRING(100), allowNull: false },
  deskripsi: { type: DataTypes.TEXT },
}, {
  tableName: 'kategori_pelanggan',
  timestamps: true,
});

module.exports = KategoriPelanggan;
