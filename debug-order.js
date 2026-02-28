const { Order } = require('./src/models');
require('dotenv').config();

async function testOrderFetch() {
  try {
    console.log('Testing Order fetch...');
    const order = await Order.findOne({
      logging: console.log
    });
    if (order) {
      console.log('✓ Order fetched successfully');
      console.log('Tracking Number:', order.tracking_number);
    } else {
      console.log('No orders found');
    }
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

testOrderFetch();
