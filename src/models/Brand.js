const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { slugify } = require('../utils/helpers');

const Brand = sequelize.define('Brand', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: true, // Allow null during validation so hook can fill it
    unique: true
  },
  logo: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'brands',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeValidate: (brand) => {
      if (brand.name && !brand.slug) {
        brand.slug = slugify(brand.name);
      }
    }
  }
});

module.exports = Brand;
