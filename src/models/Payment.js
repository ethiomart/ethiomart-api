const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'orders',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  transaction_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  },
  payment_method: {
    type: DataTypes.ENUM('card', 'mobile_money', 'bank_transfer', 'cod'),
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'ETB'
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  chapa_tx_ref: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
  },
  chapa_response: {
    type: DataTypes.JSON,
    allowNull: true
  },
  payment_data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refunded_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refund_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'payments',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['order_id']
    },
    {
      unique: true,
      fields: ['transaction_id']
    },
    {
      fields: ['chapa_tx_ref']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = Payment;
