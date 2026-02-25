'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'phone', {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true,
      after: 'last_name'
    });
    
    // Add index for phone column
    await queryInterface.addIndex('users', ['phone'], {
      unique: true,
      name: 'users_phone_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index first
    await queryInterface.removeIndex('users', 'users_phone_unique');
    
    // Remove column
    await queryInterface.removeColumn('users', 'phone');
  }
};
