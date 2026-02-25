const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StaticPage = sequelize.define('StaticPage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false
  },
  meta_title: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  meta_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'static_pages',
  timestamps: true,
  underscored: true
});

module.exports = StaticPage;
