const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Notification Model
 * Stores in-app notifications for users and sellers
 */
const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  type: {
    type: DataTypes.ENUM('order_status', 'payment', 'product', 'system'),
    allowNull: false,
    defaultValue: 'system',
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  related_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID of related entity (orderId, productId, etc.)',
  },
  related_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Type of related entity (order, product, etc.)',
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'notifications',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id'],
    },
    {
      fields: ['is_read'],
    },
    {
      fields: ['created_at'],
    },
  ],
});

module.exports = Notification;
