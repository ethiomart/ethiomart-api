const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VariantValue = sequelize.define('VariantValue', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  variant_option_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'variant_options',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  value_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: {
        args: [1, 100],
        msg: 'Value name must be between 1 and 100 characters'
      }
    }
  },
  value_position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: 1,
        msg: 'Value position must be at least 1'
      },
      isInt: {
        msg: 'Value position must be an integer'
      }
    }
  }
}, {
  tableName: 'variant_values',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['variant_option_id']
    },
    {
      unique: true,
      fields: ['variant_option_id', 'value_position'],
      name: 'variant_values_option_position_unique'
    }
  ]
});

module.exports = VariantValue;
