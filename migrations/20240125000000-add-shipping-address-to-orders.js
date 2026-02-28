'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the column already exists
    const ordersTable = await queryInterface.describeTable('orders');
    
    if (!ordersTable.shipping_address) {
      // Add shipping_address column to orders table
      await queryInterface.addColumn('orders', 'shipping_address', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Snapshot of shipping address at order time for historical record keeping'
      });
      
      console.log('✅ Added shipping_address column to orders table');
    } else {
      console.log('ℹ️  shipping_address column already exists in orders table');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Check if the column exists before removing
    const ordersTable = await queryInterface.describeTable('orders');
    
    if (ordersTable.shipping_address) {
      // Remove shipping_address column from orders table
      await queryInterface.removeColumn('orders', 'shipping_address');
      
      console.log('✅ Removed shipping_address column from orders table');
    } else {
      console.log('ℹ️  shipping_address column does not exist in orders table');
    }
  }
};
