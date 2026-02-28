const { User } = require('./src/models');
require('dotenv').config();

async function generateAdminToken() {
  try {
    const admin = await User.findOne({ 
      where: { email: 'admin@ecommerce.com' }
    });
    
    if (admin) {
      const token = admin.generateAccessToken();
      console.log(token);
    } else {
      console.error('✗ No admin user found!');
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

generateAdminToken();
