const { Sequelize } = require('sequelize');
require('dotenv').config();

/**
 * Create database if it doesn't exist
 * This function connects to MySQL without specifying a database,
 * then creates the target database if needed
 */
async function createDatabaseIfNotExists() {
  const tempConnection = new Sequelize('', process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  });

  try {
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
    console.log(`✓ Database '${process.env.DB_NAME}' is ready`);
  } catch (error) {
    console.error('Error creating database:', error.message);
    if (error.message.includes('Access denied')) {
      console.error('\n⚠️  MySQL Authentication Failed!');
      console.error('Please verify your database credentials in the .env file:');
      console.error(`   DB_HOST: ${process.env.DB_HOST}`);
      console.error(`   DB_PORT: ${process.env.DB_PORT}`);
      console.error(`   DB_USER: ${process.env.DB_USER}`);
      console.error('   DB_PASSWORD: [Check your MySQL password]');
      console.error('\nTip: If your password is stored in a vault, make sure to update the .env file with the actual password.\n');
    }
    throw error;
  } finally {
    await tempConnection.close();
  }
}

// Main Sequelize instance for the application
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    retry: {
      max: 3,
      timeout: 3000
    }
  }
);

/**
 * Initialize database connection with retry logic
 * @param {number} maxRetries - Maximum number of connection attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 */
async function initializeDatabase(maxRetries = 3, retryDelay = 2000) {
  let lastError;
  
  // First, ensure database exists
  await createDatabaseIfNotExists();
  
  // Then attempt to connect with retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sequelize.authenticate();
      console.log(`✓ Database connection established successfully (attempt ${attempt}/${maxRetries})`);
      return true;
    } catch (error) {
      lastError = error;
      console.error(`✗ Connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${lastError.message}`);
}

module.exports = sequelize;
module.exports.initializeDatabase = initializeDatabase;
module.exports.createDatabaseIfNotExists = createDatabaseIfNotExists;
