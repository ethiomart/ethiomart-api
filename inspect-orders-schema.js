/**
 * Script to inspect the orders table schema in the database
 * This will help identify any mismatches between the model and actual database
 */

const { sequelize } = require('./src/models');

async function inspectOrdersSchema() {
  try {
    console.log('Connecting to database...\n');
    await sequelize.authenticate();
    console.log('✓ Database connection established\n');

    // Get table description
    console.log('=== ORDERS TABLE SCHEMA ===\n');
    const [results] = await sequelize.query('DESCRIBE orders');
    
    console.log('Column Details:');
    console.log('─'.repeat(100));
    console.log(
      'Field'.padEnd(30) + 
      'Type'.padEnd(20) + 
      'Null'.padEnd(8) + 
      'Key'.padEnd(8) + 
      'Default'.padEnd(15) + 
      'Extra'
    );
    console.log('─'.repeat(100));
    
    results.forEach(column => {
      console.log(
        column.Field.padEnd(30) + 
        column.Type.padEnd(20) + 
        column.Null.padEnd(8) + 
        (column.Key || '').padEnd(8) + 
        (column.Default !== null ? String(column.Default) : 'NULL').padEnd(15) + 
        (column.Extra || '')
      );
    });
    
    console.log('─'.repeat(100));
    console.log(`\nTotal columns: ${results.length}\n`);

    // Check for foreign key constraints
    console.log('=== FOREIGN KEY CONSTRAINTS ===\n');
    const [fkResults] = await sequelize.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'orders'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    if (fkResults.length > 0) {
      fkResults.forEach(fk => {
        console.log(`${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    } else {
      console.log('No foreign key constraints found');
    }
    
    console.log('\n=== INDEXES ===\n');
    const [indexResults] = await sequelize.query('SHOW INDEX FROM orders');
    
    const indexes = {};
    indexResults.forEach(idx => {
      if (!indexes[idx.Key_name]) {
        indexes[idx.Key_name] = [];
      }
      indexes[idx.Key_name].push(idx.Column_name);
    });
    
    Object.entries(indexes).forEach(([name, columns]) => {
      console.log(`${name}: ${columns.join(', ')}`);
    });

    // Check if shipping_address column exists
    console.log('\n=== SHIPPING ADDRESS FIELD CHECK ===\n');
    const shippingAddressColumn = results.find(col => 
      col.Field === 'shipping_address' || col.Field === 'shippingAddress'
    );
    
    if (shippingAddressColumn) {
      console.log(`✓ Found: ${shippingAddressColumn.Field}`);
      console.log(`  Type: ${shippingAddressColumn.Type}`);
      console.log(`  Null: ${shippingAddressColumn.Null}`);
      console.log(`  Default: ${shippingAddressColumn.Default}`);
    } else {
      console.log('✗ shipping_address column NOT FOUND in database');
      console.log('  This is likely causing the database validation error!');
    }

    // Check for seller_id column
    console.log('\n=== SELLER ID FIELD CHECK ===\n');
    const sellerIdColumn = results.find(col => 
      col.Field === 'seller_id' || col.Field === 'sellerId'
    );
    
    if (sellerIdColumn) {
      console.log(`✓ Found: ${sellerIdColumn.Field}`);
      console.log(`  Type: ${sellerIdColumn.Type}`);
      console.log(`  Null: ${sellerIdColumn.Null}`);
    } else {
      console.log('✗ seller_id column NOT FOUND in database');
    }

    // List all NOT NULL columns
    console.log('\n=== REQUIRED FIELDS (NOT NULL) ===\n');
    const requiredFields = results.filter(col => col.Null === 'NO' && col.Extra !== 'auto_increment');
    requiredFields.forEach(col => {
      console.log(`- ${col.Field} (${col.Type})${col.Default !== null ? ` [default: ${col.Default}]` : ''}`);
    });

    console.log('\n=== ANALYSIS COMPLETE ===\n');
    
  } catch (error) {
    console.error('Error inspecting schema:', error);
  } finally {
    await sequelize.close();
  }
}

inspectOrdersSchema();
