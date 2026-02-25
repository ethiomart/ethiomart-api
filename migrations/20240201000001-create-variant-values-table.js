'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('variant_values', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      variant_option_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'variant_options',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      value_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      value_position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1
        }
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

    // Add index on variant_option_id for query performance
    await queryInterface.addIndex('variant_values', ['variant_option_id'], {
      name: 'variant_values_option_id_idx'
    });

    // Add unique constraint on variant_option_id and value_position
    await queryInterface.addConstraint('variant_values', {
      fields: ['variant_option_id', 'value_position'],
      type: 'unique',
      name: 'variant_values_option_position_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop constraints and indexes first
    await queryInterface.removeConstraint('variant_values', 'variant_values_option_position_unique');
    await queryInterface.removeIndex('variant_values', 'variant_values_option_id_idx');
    
    // Drop the table
    await queryInterface.dropTable('variant_values');
  }
};
