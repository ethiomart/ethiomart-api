const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AttributeValue = sequelize.define('AttributeValue', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  attribute_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'attributes',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  value: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  color_code: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'attribute_values',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = AttributeValue;
