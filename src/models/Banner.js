const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Banner = sequelize.define('Banner', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  image_url: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  link_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  position: {
    type: DataTypes.ENUM('home_main', 'home_side', 'category_top'),
    defaultValue: 'home_main'
  }
}, {
  tableName: 'banners',
  timestamps: true,
  underscored: true
});

module.exports = Banner;
