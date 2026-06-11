const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pengaduan = sequelize.define('Pengaduan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  no_tiket: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  pelanggan_id: { type: DataTypes.INTEGER, allowNull: false },
  jenis_pengaduan: {
    type: DataTypes.ENUM(
      'air_tidak_mengalir', 'air_keruh', 'meter_rusak', 'kebocoran_pipa',
      'tagihan_tidak_sesuai', 'sambungan_bermasalah', 'pasang_baru',
      'tutup_sementara', 'lainnya'
    ),
    allowNull: false,
  },
  prioritas: {
    type: DataTypes.ENUM('rendah', 'sedang', 'tinggi', 'darurat'),
    defaultValue: 'sedang',
  },
  deskripsi: { type: DataTypes.TEXT, allowNull: false },
  foto_sebelum: { type: DataTypes.STRING(255) },
  petugas_id: { type: DataTypes.INTEGER },
  catatan_tindakan: { type: DataTypes.TEXT },
  foto_sesudah: { type: DataTypes.STRING(255) },
  status: {
    type: DataTypes.ENUM('baru', 'diverifikasi', 'ditugaskan', 'dalam_proses', 'menunggu_pelanggan', 'selesai', 'ditolak', 'dibatalkan'),
    defaultValue: 'baru',
  },
  rating: { type: DataTypes.INTEGER },
  catatan_penutup: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER },
  selesai_at: { type: DataTypes.DATE },
}, {
  tableName: 'pengaduan',
  timestamps: true,
});

module.exports = Pengaduan;
