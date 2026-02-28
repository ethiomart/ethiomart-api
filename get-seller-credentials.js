const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
  }
);

async function getSellerCredentials() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected\n');

    const [sellers] = await sequelize.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, s.id as seller_id, s.store_name
      FROM users u
      INNER JOIN sellers s ON u.id = s.user_id
      WHERE u.role = 'seller'
      LIMIT 5
    `);

    console.log('Available Seller Accounts:');
    console.log('─'.repeat(60));
    sellers.forEach((seller, index) => {
      console.log(`${index + 1}. Email: ${seller.email}`);
      console.log(`   Name: ${seller.first_name} ${seller.last_name}`);
      console.log(`   Store: ${seller.store_name || 'N/A'}`);
      console.log(`   User ID: ${seller.id}, Seller ID: ${seller.seller_id}`);
      console.log('');
    });

    console.log('Note: Use password "password123" for test accounts');
    console.log('Or check your database for the actual password hash\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

getSellerCredentials();
