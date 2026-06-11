const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pelanggan = sequelize.define('Pelanggan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  no_pelanggan: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  no_sambungan: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  nama: { type: DataTypes.STRING(100), allowNull: false },
  nik: { type: DataTypes.STRING(20) },
  alamat: { type: DataTypes.TEXT, allowNull: false },
  rt_rw: { type: DataTypes.STRING(10) },
  kelurahan: { type: DataTypes.STRING(100) },
  kecamatan: { type: DataTypes.STRING(100) },
  no_hp: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(100) },
  kategori_id: { type: DataTypes.INTEGER },
  status: {
    type: DataTypes.ENUM('aktif', 'nonaktif', 'putus_sementara', 'putus_permanen'),
    defaultValue: 'aktif',
  },
  tanggal_daftar: { type: DataTypes.DATEONLY },
  rute_id: { type: DataTypes.INTEGER },
  catatan: { type: DataTypes.TEXT },
}, {
  tableName: 'pelanggan',
  timestamps: true,
});

module.exports = Pelanggan;
