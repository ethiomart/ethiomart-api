const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixOrdersSchemaMore() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('Fixing more orders table schema inconsistencies...');

    const [cols] = await connection.query('DESCRIBE orders');
    const existingCols = cols.map(col => col.Field);

    // Add updated_by if missing
    if (!existingCols.includes('updated_by')) {
      await connection.query('ALTER TABLE orders ADD COLUMN updated_by INT NULL AFTER carrier');
      console.log('  Added updated_by to orders');
    }

    console.log('\nOrders schema fix completed.');
  } catch (error) {
    console.error('Error fixing orders schema:', error.message);
  } finally {
    await connection.end();
  }
}

fixOrdersSchemaMore();
