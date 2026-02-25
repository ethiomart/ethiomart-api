const { User, Seller, Product, Order, sequelize } = require('../../models');
const { Op } = require('sequelize');

/**
 * Get dashboard statistics
 * Returns counts and trends for key metrics
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    // Get current counts
    const [
      totalUsers,
      totalSellers,
      totalProducts,
      totalOrders,
      totalRevenue
    ] = await Promise.all([
      User.count({ where: { role: 'customer' } }),
      Seller.count({ where: { status: 'approved' } }),
      Product.count({ where: { status: 'approved' } }),
      Order.count(),
      Order.sum('totalAmount', { where: { status: { [Op.in]: ['completed', 'delivered'] } } })
    ]);

    // Get counts from 30 days ago for trend calculation
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
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Seller.count({ 
        where: { 
          status: 'approved',
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Product.count({ 
        where: { 
          status: 'approved',
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Order.count({ 
        where: { 
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Order.sum('totalAmount', { 
        where: { 
          status: { [Op.in]: ['completed', 'delivered'] },
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      })
    ]);

    // Calculate trends (percentage change)
    const calculateTrend = (current, previous) => {
      if (previous === 0) {
        return { value: current > 0 ? 100 : 0, direction: 'up' };
      }
      const change = ((current - previous) / previous) * 100;
      return {
        value: Math.abs(Math.round(change * 10) / 10),
        direction: change >= 0 ? 'up' : 'down'
      };
    };

    const stats = {
      totalUsers,
      totalSellers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue || 0,
      usersTrend: calculateTrend(totalUsers, usersLastMonth),
      sellersTrend: calculateTrend(totalSellers, sellersLastMonth),
      productsTrend: calculateTrend(totalProducts, productsLastMonth),
      ordersTrend: calculateTrend(totalOrders, ordersLastMonth),
      revenueTrend: calculateTrend(totalRevenue || 0, revenueLastMonth || 0)
    };

    res.json({
      success: true,
      data: stats
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
    // Get pending approvals
    const [pendingSellers, pendingProducts] = await Promise.all([
      Seller.count({ where: { status: 'pending' } }),
      Product.count({ where: { status: 'pending' } })
    ]);

    // Get recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentOrders = await Order.count({
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo }
      }
    });

    // Get revenue by status
    const revenueByStatus = await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'total']
      ],
      group: ['status']
    });

    const overview = {
      pendingApprovals: {
        sellers: pendingSellers,
        products: pendingProducts,
        total: pendingSellers + pendingProducts
      },
      recentOrders,
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
