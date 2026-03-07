const { User, Seller, Product, Order, OrderItem, Category, sequelize } = require('../../models');
const { Op } = require('sequelize');

/**
 * Get dashboard statistics
 * Returns counts and trends for key metrics
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    // 1. Basic KPI Stats
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
      Order.sum('total_amount', { where: { order_status: { [Op.in]: ['confirmed', 'processing', 'shipped', 'delivered', 'completed'] } } })
    ]);

    // Trend calculation (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      usersLastMonth,
      sellersLastMonth,
      productsLastMonth,
      ordersLastMonth,
      revenueLastMonth
    ] = await Promise.all([
      User.count({ where: { role: 'customer', created_at: { [Op.lt]: thirtyDaysAgo } } }),
      Seller.count({ where: { approval_status: 'approved', created_at: { [Op.lt]: thirtyDaysAgo } } }),
      Product.count({ where: { approval_status: 'approved', created_at: { [Op.lt]: thirtyDaysAgo } } }),
      Order.count({ where: { created_at: { [Op.lt]: thirtyDaysAgo } } }),
      Order.sum('total_amount', { 
        where: { 
          order_status: { [Op.in]: ['confirmed', 'processing', 'shipped', 'delivered', 'completed'] },
          created_at: { [Op.lt]: thirtyDaysAgo } 
        } 
      })
    ]);

    const calculateTrend = (current, previous) => {
      if (!previous) return { value: current > 0 ? 100 : 0, direction: 'up' };
      const change = ((current - previous) / previous) * 100;
      return {
        value: Math.abs(Math.round(change * 10) / 10),
        direction: change >= 0 ? 'up' : 'down'
      };
    };

    // Additional Stats for Dashboard Cards
    const pendingOrders = await Order.count({ where: { order_status: 'pending' } });
    const lowStockProducts = await Product.count({
      where: {
        approval_status: 'approved',
        quantity: { [Op.lte]: sequelize.col('low_stock_threshold') }
      }
    });

    const stats = {
      totalUsers,
      totalSellers,
      totalProducts,
      totalOrders,
      totalRevenue: parseFloat(totalRevenue || 0),
      pendingOrders,
      lowStockProducts,
      usersTrend: calculateTrend(totalUsers, usersLastMonth),
      sellersTrend: calculateTrend(totalSellers, sellersLastMonth),
      productsTrend: calculateTrend(totalProducts, productsLastMonth),
      ordersTrend: calculateTrend(totalOrders, ordersLastMonth),
      revenueTrend: calculateTrend(totalRevenue || 0, revenueLastMonth || 0)
    };

    // 2. Sales Trend (Last 12 Months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlySales = await sequelize.query(`
      SELECT 
        DATE_FORMAT(created_at, '%b') as month,
        DATE_FORMAT(created_at, '%Y-%m') as monthYear,
        COUNT(id) as ordersCount,
        SUM(total_amount) as revenueAmount
      FROM orders
      WHERE created_at >= :twelveMonthsAgo
        AND order_status NOT IN ('cancelled', 'returned')
      GROUP BY monthYear, month
      ORDER BY monthYear ASC
    `, {
      replacements: { twelveMonthsAgo: twelveMonthsAgo },
      type: sequelize.QueryTypes.SELECT
    });

    const salesDataRaw = monthlySales.map(item => ({
      name: item.month,
      orders: parseInt(item.ordersCount || 0),
      revenue: parseFloat(item.revenueAmount || 0),
      sales: parseFloat(item.revenueAmount || 0)
    }));

    // Fill missing months with zero
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIndex = new Date().getMonth();
    const last12Months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(currentMonthIndex - i);
      last12Months.push(months[d.getMonth()]);
    }

    const salesData = last12Months.map(month => {
      const match = salesDataRaw.find(d => d.name === month);
      return match || { name: month, orders: 0, revenue: 0, sales: 0 };
    });

    // 3. Category Distribution
    const categoryDistribution = await OrderItem.findAll({
      attributes: [
        [sequelize.col('product.category.name'), 'name'],
        [sequelize.fn('COUNT', sequelize.col('OrderItem.id')), 'value']
      ],
      include: [{
        model: Product,
        as: 'product',
        attributes: [],
        include: [{
          model: Category,
          as: 'category',
          attributes: []
        }]
      }],
      group: [
        sequelize.col('product.category.id'),
        'product.category.name'
      ],
      limit: 5,
      order: [[sequelize.fn('COUNT', sequelize.col('OrderItem.id')), 'DESC']]
    });

    const categoryData = categoryDistribution.map(item => ({
      name: item.getDataValue('name') || 'Uncategorized',
      value: parseInt(item.getDataValue('value'))
    }));

    // 4. Recent Orders
    const recentOrdersRaw = await Order.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['first_name', 'last_name']
      }]
    });

    const recentOrders = recentOrdersRaw.map(order => ({
      id: `#${order.order_number}`,
      customer: order.user ? `${order.user.first_name} ${order.user.last_name}` : 'Guest',
      amount: parseFloat(order.total_amount),
      status: order.order_status,
      date: order.created_at.toISOString().split('T')[0]
    }));

    // 5. Top Products
    const topProductsRaw = await OrderItem.findAll({
      attributes: [
        [sequelize.col('product.name'), 'name'],
        [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'sales'],
        [sequelize.fn('SUM', sequelize.literal('OrderItem.quantity * OrderItem.price_at_purchase')), 'revenue']
      ],
      include: [{
        model: Product,
        as: 'product',
        attributes: []
      }],
      group: [
        sequelize.col('product.id'),
        'product.name'
      ],
      limit: 5,
      order: [[sequelize.fn('SUM', sequelize.literal('OrderItem.quantity * OrderItem.price_at_purchase')), 'DESC']]
    });

    const topProducts = topProductsRaw.map(item => ({
      name: item.getDataValue('name'),
      sales: parseInt(item.getDataValue('sales')),
      revenue: parseFloat(item.getDataValue('revenue'))
    }));

    res.json({
      success: true,
      data: {
        stats,
        salesData,
        categoryData,
        recentOrders,
        topProducts
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard overview with detailed metrics
 */
exports.getDashboardOverview = async (req, res, next) => {
  try {
    const [pendingSellers, pendingProducts, pendingOrders] = await Promise.all([
      Seller.count({ where: { approval_status: 'pending' } }),
      Product.count({ where: { approval_status: 'pending' } }),
      Order.count({ where: { order_status: 'pending' } })
    ]);

    // Get revenue by status (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueByStatus = await Order.findAll({
      attributes: [
        ['order_status', 'status'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'total']
      ],
      where: {
        created_at: { [Op.gte]: thirtyDaysAgo }
      },
      group: ['order_status']
    });

    const overview = {
      pendingApprovals: {
        sellers: pendingSellers,
        products: pendingProducts,
        orders: pendingOrders,
        total: pendingSellers + pendingProducts + pendingOrders
      },
      revenueByStatus: revenueByStatus.map(item => ({
        status: item.status,
        total: parseFloat(item.dataValues.total || 0)
      }))
    };

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
};
