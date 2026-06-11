const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pembayaran = sequelize.define('Pembayaran', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  no_pembayaran: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  tagihan_id: { type: DataTypes.INTEGER, allowNull: false },
  pelanggan_id: { type: DataTypes.INTEGER, allowNull: false },
  tanggal_bayar: { type: DataTypes.DATEONLY, allowNull: false },
  jumlah_bayar: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  metode: {
    type: DataTypes.ENUM('tunai', 'transfer', 'qris', 'lainnya'),
    defaultValue: 'tunai',
  },
  kasir_id: { type: DataTypes.INTEGER },
  bukti_pembayaran: { type: DataTypes.STRING(255) },
  catatan: { type: DataTypes.TEXT },
}, {
  tableName: 'pembayaran',
  timestamps: true,
});

module.exports = Pembayaran;
