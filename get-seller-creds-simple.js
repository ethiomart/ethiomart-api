const { Sequelize } = require('sequelize');
const sequelize = require('./src/config/database');

async function getSellerCredentials() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');

    const [users] = await sequelize.query(`
      SELECT u.id, u.email, u.role, s.id as seller_id, s.store_name
      FROM users u
      LEFT JOIN sellers s ON u.id = s.user_id
      WHERE u.role = 'seller'
      LIMIT 5
    `);

    console.log('\nSeller Users:');
    users.forEach(user => {
      console.log(`Email: ${user.email}, Role: ${user.role}, Seller ID: ${user.seller_id}, Store: ${user.store_name}`);
    });

    console.log('\nNote: Default password for test users is usually "password123"');
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getSellerCredentials();
