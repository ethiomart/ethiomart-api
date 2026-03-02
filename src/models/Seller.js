const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Seller = sequelize.define('Seller', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  store_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  store_slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  store_logo: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  store_banner: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  store_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  business_registration: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  business_license_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  verification_doc_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  tax_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  business_address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  business_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  business_email: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  bank_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  bank_account_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  bank_account_number: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  bank_branch_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  commission_rate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 10.00
  },
  approval_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0
  },
  total_reviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_revenue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  total_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'sellers',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id']
    },
    {
      unique: true,
      fields: ['store_slug']
    }
  ]
});

module.exports = Seller;
