const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pemasukan = sequelize.define('Pemasukan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  no_pemasukan: { type: DataTypes.STRING(20), unique: true },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  kategori: {
    type: DataTypes.ENUM('hibah_desa','hibah_kecamatan','hibah_pemerintah','donasi','retribusi','lain_lain'),
    allowNull: false,
  },
  sumber: { type: DataTypes.STRING(150), allowNull: false },
  keterangan: { type: DataTypes.STRING(255) },
  jumlah: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  metode_terima: { type: DataTypes.ENUM('tunai','transfer'), defaultValue: 'tunai' },
  catatan: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER },
}, {
  tableName: 'pemasukan',
  timestamps: true,
});

module.exports = Pemasukan;
