const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pengeluaran = sequelize.define('Pengeluaran', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  no_pengeluaran: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  kategori: {
    type: DataTypes.ENUM('operasional','pemeliharaan','gaji','utilitas','perlengkapan','lain_lain'),
    allowNull: false,
    defaultValue: 'operasional',
  },
  sumber_dana: {
    type: DataTypes.ENUM('abodemen','pemakaian_air','hibah'),
    allowNull: true,
    defaultValue: null,
  },
  keterangan: { type: DataTypes.STRING(255), allowNull: false },
  jumlah: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  metode_bayar: {
    type: DataTypes.ENUM('tunai', 'transfer'),
    defaultValue: 'tunai',
  },
  catatan: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER },
}, {
  tableName: 'pengeluaran',
  timestamps: true,
});

module.exports = Pengeluaran;
