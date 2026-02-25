'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add variant_combination_id column to cart_items table
    await queryInterface.addColumn('cart_items', 'variant_combination_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'variant_combinations',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      after: 'product_id'
    });

    // Add index on variant_combination_id for query performance
    await queryInterface.addIndex('cart_items', ['variant_combination_id'], {
      name: 'cart_items_variant_combination_id_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop index first
    await queryInterface.removeIndex('cart_items', 'cart_items_variant_combination_id_idx');
    
    // Drop the column
    await queryInterface.removeColumn('cart_items', 'variant_combination_id');
  }
};
