const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CategoryTemplate = sequelize.define('CategoryTemplate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  category_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      len: {
        args: [1, 100],
        msg: 'Category name must be between 1 and 100 characters'
      }
    }
  },
  template_options: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'JSON structure: {"options": [{"name": "Size", "values": ["S", "M", "L"]}, ...]}',
    validate: {
      isValidJSON(value) {
        if (typeof value !== 'object' || !value.options || !Array.isArray(value.options)) {
          throw new Error('template_options must be a JSON object with an "options" array');
        }
      }
    },
    get() {
      const rawValue = this.getDataValue('template_options');
      // Handle both JSON object and string formats
      if (typeof rawValue === 'object') {
        return rawValue;
      }
      if (typeof rawValue === 'string') {
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return { options: [] };
        }
      }
      return { options: [] };
    }
  }
}, {
  tableName: 'category_templates',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['category_name']
    }
  ]
});

module.exports = CategoryTemplate;
