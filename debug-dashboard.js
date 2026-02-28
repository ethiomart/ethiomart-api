const { User, Seller, Product, Order, sequelize } = require('./src/models');
const { Op } = require('sequelize');

async function debugDashboard() {
  try {
    console.log('Debugging Dashboard Stats...');
    const [
      totalUsers,
      totalSellers,
      totalProducts,
      totalOrders,
      totalRevenue
    ] = await Promise.all([
      User.count({ where: { role: 'customer' } }),
      Seller.count({ where: { approval_status: 'approved' } }),
      Product.count({ where: { approval_status: 'approved' } }),
      Order.count(),
      Order.sum('total_amount', { where: { order_status: { [Op.in]: ['completed', 'delivered'] } } })
    ]);
    console.log('✓ Counts fetched');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      usersLastMonth,
      sellersLastMonth,
      productsLastMonth,
      ordersLastMonth,
      revenueLastMonth
    ] = await Promise.all([
      User.count({ 
        where: { 
          role: 'customer',
          created_at: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Seller.count({ 
        where: { 
          approval_status: 'approved',
          created_at: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Product.count({ 
        where: { 
          approval_status: 'approved',
          created_at: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Order.count({ 
        where: { 
          created_at: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Order.sum('total_amount', { 
        where: { 
          order_status: { [Op.in]: ['completed', 'delivered'] },
          created_at: { [Op.lt]: thirtyDaysAgo }
        } 
      })
    ]);
    console.log('✓ Last month data fetched');
    process.exit(0);
  } catch (error) {
    console.error('✗ Dashboard Debug Error:', error.message);
    if (error.parent) console.error('  Parent Error:', error.parent.message);
    process.exit(1);
  }
}

debugDashboard();
