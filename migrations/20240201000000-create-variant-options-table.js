'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('variant_options', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      option_name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      option_position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 3
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

    // Add index on product_id for query performance
    await queryInterface.addIndex('variant_options', ['product_id'], {
      name: 'variant_options_product_id_idx'
    });

    // Add unique constraint on product_id and option_position
    await queryInterface.addConstraint('variant_options', {
      fields: ['product_id', 'option_position'],
      type: 'unique',
      name: 'variant_options_product_position_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop constraints and indexes first
    await queryInterface.removeConstraint('variant_options', 'variant_options_product_position_unique');
    await queryInterface.removeIndex('variant_options', 'variant_options_product_id_idx');
    
    // Drop the table
    await queryInterface.dropTable('variant_options');
  }
};
