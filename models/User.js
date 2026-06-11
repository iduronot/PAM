const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nama: { type: DataTypes.STRING(100), allowNull: false },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(100), unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: {
    type: DataTypes.ENUM('super_admin', 'admin_pam', 'petugas_meter', 'kasir', 'manajer', 'pelanggan'),
    allowNull: false,
    defaultValue: 'admin_pam',
  },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  pelanggan_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
