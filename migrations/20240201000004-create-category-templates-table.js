'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('category_templates', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      category_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      template_options: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'JSON structure: {"options": [{"name": "Size", "values": ["S", "M", "L"]}, ...]}'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add unique index on category_name
    await queryInterface.addIndex('category_templates', ['category_name'], {
      name: 'category_templates_name_idx',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop indexes first
    await queryInterface.removeIndex('category_templates', 'category_templates_name_idx');
    
    // Drop the table
    await queryInterface.dropTable('category_templates');
  }
};
