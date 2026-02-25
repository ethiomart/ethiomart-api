'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('variant_combinations', {
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
      sku: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      stock_quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      cart_additions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      purchases: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0
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
    await queryInterface.addIndex('variant_combinations', ['product_id'], {
      name: 'variant_combinations_product_id_idx'
    });

    // Add unique index on sku for uniqueness enforcement
    await queryInterface.addIndex('variant_combinations', ['sku'], {
      name: 'variant_combinations_sku_idx',
      unique: true
    });

    // Add index on is_active for filtering active variants
    await queryInterface.addIndex('variant_combinations', ['is_active'], {
      name: 'variant_combinations_is_active_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop indexes first
    await queryInterface.removeIndex('variant_combinations', 'variant_combinations_is_active_idx');
    await queryInterface.removeIndex('variant_combinations', 'variant_combinations_sku_idx');
    await queryInterface.removeIndex('variant_combinations', 'variant_combinations_product_id_idx');
    
    // Drop the table
    await queryInterface.dropTable('variant_combinations');
  }
};
