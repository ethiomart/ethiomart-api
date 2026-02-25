const sequelize = require('../config/database');
const { initializeDatabase } = require('../config/database');

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful, false otherwise
 */
async function testDatabaseConnection() {
  try {
    // Initialize database (creates if not exists and connects)
    await initializeDatabase();
    
    // Test query execution
    const [results] = await sequelize.query('SELECT 1 + 1 AS result');
    console.log('✓ Database query test passed:', results[0]);
    
    // Show database info
    const [dbInfo] = await sequelize.query('SELECT DATABASE() as current_db');
    console.log('✓ Connected to database:', dbInfo[0].current_db);
    
    return true;
  } catch (error) {
    console.error('✗ Unable to connect to the database:', error.message);
    return false;
  }
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
async function closeDatabaseConnection() {
  try {
    await sequelize.close();
    console.log('✓ Database connection closed successfully.');
  } catch (error) {
    console.error('✗ Error closing database connection:', error.message);
  }
}

// If run directly, test the connection
if (require.main === module) {
  testDatabaseConnection()
    .then(success => {
      if (success) {
        console.log('\n✓ All database tests passed!');
      } else {
        console.log('\n✗ Database tests failed!');
        process.exit(1);
      }
    })
    .then(() => closeDatabaseConnection())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error during database test:', error);
      process.exit(1);
    });
}

module.exports = {
  testDatabaseConnection,
  closeDatabaseConnection
};
