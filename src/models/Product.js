const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  seller_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sellers',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'categories',
      key: 'id'
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },
  brand_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  sku: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  short_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0.01,
      isDecimal: true
    }
  },
  discount_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  discount_start: {
    type: DataTypes.DATE,
    allowNull: true
  },
  discount_end: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cost_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      isInt: true
    }
  },
  low_stock_threshold: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  weight: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  length: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  width: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  height: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  meta_title: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  meta_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  meta_keywords: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_published: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
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
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  sold_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0
  },
  review_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    get() {
      const rawValue = this.getDataValue('images');
      // Handle both JSON array and string formats
      if (Array.isArray(rawValue)) {
        return rawValue;
      }
      if (typeof rawValue === 'string') {
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return [];
        }
      }
      return [];
    }
  }
}, {
  tableName: 'products',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['seller_id']
    },
    {
      fields: ['category_id']
    },
    {
      fields: ['is_published']
    }
  ]
});

module.exports = Product;
