const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WishlistItem = sequelize.define('WishlistItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  wishlist_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'wishlists',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  }
}, {
  tableName: 'wishlist_items',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['wishlist_id', 'product_id']
    }
  ]
});

module.exports = WishlistItem;
