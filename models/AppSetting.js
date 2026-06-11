const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AppSetting = sequelize.define('AppSetting', {
  key: { type: DataTypes.STRING(100), primaryKey: true },
  value: { type: DataTypes.TEXT },
  label: { type: DataTypes.STRING(255) },
}, {
  tableName: 'app_settings',
  timestamps: false,
});

module.exports = AppSetting;
