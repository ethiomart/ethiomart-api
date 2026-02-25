const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VariantCombinationValue = sequelize.define('VariantCombinationValue', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  variant_combination_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'variant_combinations',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  variant_value_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'variant_values',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  }
}, {
  tableName: 'variant_combination_values',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false, // No updated_at for junction table
  indexes: [
    {
      fields: ['variant_combination_id']
    },
    {
      fields: ['variant_value_id']
    },
    {
      unique: true,
      fields: ['variant_combination_id', 'variant_value_id'],
      name: 'vcv_combination_value_unique'
    }
  ]
});

module.exports = VariantCombinationValue;
