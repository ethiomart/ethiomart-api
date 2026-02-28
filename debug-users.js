const { User } = require('./src/models');
const { Op } = require('sequelize');

async function debugUsers() {
  try {
    console.log('Debugging Users fetch...');
    const { count, rows: users } = await User.findAndCountAll({
      attributes: { exclude: ['password'] },
      limit: 10,
      offset: 0,
      order: [['created_at', 'DESC']],
      logging: console.log
    });
    console.log('✓ Users fetched successfully, count:', count);
    process.exit(0);
  } catch (error) {
    console.error('✗ Users Debug Error:', error.message);
    if (error.parent) console.error('  Parent Error:', error.parent.message);
    process.exit(1);
  }
}

debugUsers();
