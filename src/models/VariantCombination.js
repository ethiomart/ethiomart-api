const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VariantCombination = sequelize.define('VariantCombination', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
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
  },
  sku: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      len: {
        args: [1, 100],
        msg: 'SKU must be between 1 and 100 characters'
      },
      is: {
        args: /^[a-zA-Z0-9-]+$/,
        msg: 'SKU must contain only alphanumeric characters and hyphens'
      }
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: {
        args: 0.01,
        msg: 'Price must be at least 0.01'
      },
      isDecimal: {
        msg: 'Price must be a valid decimal number'
      }
    }
  },
  stock_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      isInt: {
        msg: 'Stock quantity must be an integer'
      },
      isNonNegative(value) {
        if (value < 0) {
          throw new Error('Stock quantity cannot be negative');
        }
      }
    }
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  cart_additions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      isInt: {
        msg: 'Cart additions must be an integer'
      },
      isNonNegative(value) {
        if (value < 0) {
          throw new Error('Cart additions cannot be negative');
        }
      }
    }
  },
  purchases: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      isInt: {
        msg: 'Purchases must be an integer'
      },
      isNonNegative(value) {
        if (value < 0) {
          throw new Error('Purchases cannot be negative');
        }
      }
    }
  }
}, {
  tableName: 'variant_combinations',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['product_id']
    },
    {
      unique: true,
      fields: ['sku']
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = VariantCombination;
