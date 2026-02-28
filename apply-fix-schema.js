const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('Fixing schema inconsistencies...');

    // Fix orders table
    console.log('Updating orders table...');
    const [orderCols] = await connection.query('DESCRIBE orders');
    const existingOrderCols = orderCols.map(col => col.Field);
    
    if (!existingOrderCols.includes('tracking_number')) {
      await connection.query('ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(255) NULL AFTER estimated_delivery_date');
      console.log('  Added tracking_number to orders');
    }
    if (!existingOrderCols.includes('carrier')) {
      await connection.query('ALTER TABLE orders ADD COLUMN carrier VARCHAR(100) NULL AFTER tracking_number');
      console.log('  Added carrier to orders');
    }

    // Fix banners table
    console.log('Updating banners table...');
    const [bannerCols] = await connection.query('DESCRIBE banners');
    const existingBannerCols = bannerCols.map(col => col.Field);
    
    if (!existingBannerCols.includes('link_url')) {
      await connection.query('ALTER TABLE banners ADD COLUMN link_url VARCHAR(255) NULL AFTER image_url');
      console.log('  Added link_url to banners');
    }

    // Fix categories table
    console.log('Updating categories table...');
    const [categoryCols] = await connection.query('DESCRIBE categories');
    const existingCategoryCols = categoryCols.map(col => col.Field);
    
    if (!existingCategoryCols.includes('sort_order')) {
      await connection.query('ALTER TABLE categories ADD COLUMN sort_order INT DEFAULT 0 AFTER parent_id');
      console.log('  Added sort_order to categories');
    }

    // Fix settings table - check if 'key' is missing (it shouldn't be, but let's check what it is)
    console.log('Checking settings table...');
    const [settingsCols] = await connection.query('DESCRIBE settings');
    console.log('Settings columns:', settingsCols.map(col => col.Field).join(', '));
    // Based on previous error "Unknown column 'key' in 'field list'", let's see why it's missing.
    // If it was renamed or something.

    console.log('\nSchema fix completed successfully.');
  } catch (error) {
    console.error('Error fixing schema:', error.message);
  } finally {
    await connection.end();
  }
}

fixSchema();
