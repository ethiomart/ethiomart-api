const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixSettingsSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('Fixing settings table schema (v2)...');

    const [cols] = await connection.query('DESCRIBE settings');
    const existingCols = cols.map(col => col.Field);

    // Rename setting_key to key
    if (existingCols.includes('setting_key')) {
      await connection.query('ALTER TABLE settings CHANGE COLUMN setting_key `key` VARCHAR(100) NOT NULL UNIQUE');
      console.log('  Renamed setting_key to key');
    }

    // Rename setting_value to value
    if (existingCols.includes('setting_value')) {
      await connection.query('ALTER TABLE settings CHANGE COLUMN setting_value `value` TEXT');
      console.log('  Renamed setting_value to value');
    }

    // Fix type enum mismatch: 'text' -> 'string'
    if (existingCols.includes('setting_type')) {
        // Change to VARCHAR temporarily or just add 'text' to the new enum
        await connection.query("ALTER TABLE settings CHANGE COLUMN setting_type `type` VARCHAR(50) DEFAULT 'string'");
        await connection.query("UPDATE settings SET `type` = 'string' WHERE `type` = 'text'");
        await connection.query("ALTER TABLE settings MODIFY COLUMN `type` ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string'");
        console.log('  Fixed type column and converted "text" to "string"');
    }

    // Add group if missing
    if (!existingCols.includes('group') && !existingCols.includes('`group`')) {
      await connection.query("ALTER TABLE settings ADD COLUMN `group` VARCHAR(50) DEFAULT 'general' AFTER `value` ");
      console.log('  Added group to settings');
    }

    // Add created_at if missing
    if (!existingCols.includes('created_at')) {
      await connection.query("ALTER TABLE settings ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER `type` ");
      console.log('  Added created_at to settings');
    }
    
    // updated_at already exists in some format, let's ensure it's named correctly or present
    if (existingCols.includes('updated_at')) {
       // already exists, good
    } else {
        await connection.query("ALTER TABLE settings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        console.log('  Added updated_at to settings');
    }

    console.log('\nSettings schema fix completed.');
  } catch (error) {
    console.error('Error fixing settings schema:', error.message);
  } finally {
    await connection.end();
  }
}

fixSettingsSchema();
