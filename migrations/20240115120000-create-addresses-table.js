'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('addresses', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      full_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      address_line1: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      address_line2: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'Ethiopia'
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      type: {
        type: Sequelize.ENUM('shipping', 'billing'),
        allowNull: false,
        defaultValue: 'shipping'
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

    // Add index on user_id for query performance
    await queryInterface.addIndex('addresses', ['user_id'], {
      name: 'addresses_user_id_idx'
    });

    // Add index on is_default for default address queries
    await queryInterface.addIndex('addresses', ['is_default'], {
      name: 'addresses_is_default_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop indexes first
    await queryInterface.removeIndex('addresses', 'addresses_is_default_idx');
    await queryInterface.removeIndex('addresses', 'addresses_user_id_idx');
    
    // Drop the table
    await queryInterface.dropTable('addresses');
  }
};
