'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('variant_combination_values', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      variant_combination_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'variant_combinations',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      variant_value_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'variant_values',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index on variant_combination_id for query performance
    await queryInterface.addIndex('variant_combination_values', ['variant_combination_id'], {
      name: 'vcv_combination_id_idx'
    });

    // Add index on variant_value_id for query performance
    await queryInterface.addIndex('variant_combination_values', ['variant_value_id'], {
      name: 'vcv_value_id_idx'
    });

    // Add unique constraint on combination_id and value_id
    await queryInterface.addConstraint('variant_combination_values', {
      fields: ['variant_combination_id', 'variant_value_id'],
      type: 'unique',
      name: 'vcv_combination_value_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop constraints and indexes first
    await queryInterface.removeConstraint('variant_combination_values', 'vcv_combination_value_unique');
    await queryInterface.removeIndex('variant_combination_values', 'vcv_value_id_idx');
    await queryInterface.removeIndex('variant_combination_values', 'vcv_combination_id_idx');
    
    // Drop the table
    await queryInterface.dropTable('variant_combination_values');
  }
};
