const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VariantOption = sequelize.define('VariantOption', {
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
  option_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      len: {
        args: [1, 50],
        msg: 'Option name must be between 1 and 50 characters'
      }
    }
  },
  option_position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: 1,
        msg: 'Option position must be at least 1'
      },
      max: {
        args: 3,
        msg: 'Option position cannot exceed 3'
      },
      isInt: {
        msg: 'Option position must be an integer'
      }
    }
  }
}, {
  tableName: 'variant_options',
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
      fields: ['product_id', 'option_position'],
      name: 'variant_options_product_position_unique'
    }
  ]
});

module.exports = VariantOption;
