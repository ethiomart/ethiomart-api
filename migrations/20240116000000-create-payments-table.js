'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create payments table
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'orders',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      transaction_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      },
      payment_method: {
        type: Sequelize.ENUM('card', 'mobile_money', 'bank_transfer', 'cod'),
        allowNull: true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'ETB',
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'success', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      chapa_tx_ref: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      chapa_response: {
        type: Sequelize.JSON,
        allowNull: true
      },
      payment_data: {
        type: Sequelize.JSON,
        allowNull: true
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      refunded_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      refund_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes for better query performance
    // Note: order_id and transaction_id already have unique constraints from CREATE TABLE
    // So we only need to add the non-unique indexes
    
    try {
      await queryInterface.addIndex('payments', ['chapa_tx_ref'], {
        name: 'payments_chapa_tx_ref_idx'
      });
    } catch (error) {
      if (!error.message.includes('Duplicate key name')) throw error;
    }

    try {
      await queryInterface.addIndex('payments', ['status'], {
        name: 'payments_status_idx'
      });
    } catch (error) {
      if (!error.message.includes('Duplicate key name')) throw error;
    }

    try {
      await queryInterface.addIndex('payments', ['created_at'], {
        name: 'payments_created_at_idx'
      });
    } catch (error) {
      if (!error.message.includes('Duplicate key name')) throw error;
    }

    // Add paid_at column to orders table if it doesn't exist
    const ordersTable = await queryInterface.describeTable('orders');
    if (!ordersTable.paid_at) {
      await queryInterface.addColumn('orders', 'paid_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    // Add constraint to ensure amount is non-negative
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE payments
        ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);
      `);
    } catch (error) {
      if (!error.message.includes('Duplicate check constraint')) throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove paid_at column from orders table
    const ordersTable = await queryInterface.describeTable('orders');
    if (ordersTable.paid_at) {
      await queryInterface.removeColumn('orders', 'paid_at');
    }

    // Drop indexes (only the ones we explicitly created)
    try {
      await queryInterface.removeIndex('payments', 'payments_created_at_idx');
    } catch (error) {
      // Ignore if index doesn't exist
    }
    
    try {
      await queryInterface.removeIndex('payments', 'payments_status_idx');
    } catch (error) {
      // Ignore if index doesn't exist
    }
    
    try {
      await queryInterface.removeIndex('payments', 'payments_chapa_tx_ref_idx');
    } catch (error) {
      // Ignore if index doesn't exist
    }

    // Drop payments table
    await queryInterface.dropTable('payments');
  }
};
