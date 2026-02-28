/**
 * Create Test Users for Manual Testing - Task 19.8
 * 
 * This script creates test user accounts needed for manual testing
 */

const bcrypt = require('bcryptjs');
const db = require('./src/config/database');
const User = require('./src/models/User');

async function createTestUsers() {
  console.log('========================================');
  console.log('Creating Test User Accounts');
  console.log('========================================\n');

  try {
    await db.authenticate();
    console.log('✓ Database connected\n');

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create customer test account
    console.log('1. Creating customer test account...');
    const [customer, customerCreated] = await User.findOrCreate({
      where: { email: 'customer@example.com' },
      defaults: {
        email: 'customer@example.com',
        password: hashedPassword,
        first_name: 'Test',
        last_name: 'Customer',
        phone: '+251911111111',
        role: 'customer',
        is_active: true
      }
    });

    if (customerCreated) {
      console.log(`   ✓ Customer account created (ID: ${customer.id})`);
      console.log('     Email: customer@example.com');
      console.log('     Password: password123');
    } else {
      console.log(`   ℹ Customer account already exists (ID: ${customer.id})`);
    }
    console.log('');

    // 2. Create seller test account
    console.log('2. Creating seller test account...');
    const [seller, sellerCreated] = await User.findOrCreate({
      where: { email: 'seller@example.com' },
      defaults: {
        email: 'seller@example.com',
        password: hashedPassword,
        first_name: 'Test',
        last_name: 'Seller',
        phone: '+251922222222',
        role: 'seller',
        is_active: true
      }
    });

    if (sellerCreated) {
      console.log(`   ✓ Seller account created (ID: ${seller.id})`);
      console.log('     Email: seller@example.com');
      console.log('     Password: password123');
    } else {
      console.log(`   ℹ Seller account already exists (ID: ${seller.id})`);
    }
    console.log('');

    // 3. Create admin test account
    console.log('3. Creating admin test account...');
    const [admin, adminCreated] = await User.findOrCreate({
      where: { email: 'admin@example.com' },
      defaults: {
        email: 'admin@example.com',
        password: hashedPassword,
        first_name: 'Test',
        last_name: 'Admin',
        phone: '+251933333333',
        role: 'admin',
        is_active: true
      }
    });

    if (adminCreated) {
      console.log(`   ✓ Admin account created (ID: ${admin.id})`);
      console.log('     Email: admin@example.com');
      console.log('     Password: password123');
    } else {
      console.log(`   ℹ Admin account already exists (ID: ${admin.id})`);
    }
    console.log('');

    // Summary
    console.log('========================================');
    console.log('Test Accounts Summary');
    console.log('========================================\n');
    console.log('Customer Account:');
    console.log('  Email: customer@example.com');
    console.log('  Password: password123');
    console.log('  Role: customer\n');
    console.log('Seller Account:');
    console.log('  Email: seller@example.com');
    console.log('  Password: password123');
    console.log('  Role: seller\n');
    console.log('Admin Account:');
    console.log('  Email: admin@example.com');
    console.log('  Password: password123');
    console.log('  Role: admin\n');
    console.log('✅ Test accounts are ready for manual testing!\n');

  } catch (error) {
    console.error('❌ Error creating test users:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run script
createTestUsers();
