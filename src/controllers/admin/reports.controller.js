const { Order, User, OrderItem, Product, Seller, Category, sequelize } = require('../../models');
const { Op } = require('sequelize');

/**
 * Sales Report
 */
exports.getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, dateFrom, dateTo, period = 'day' } = req.query;
    const start = startDate || dateFrom;
    const end = endDate || dateTo;
    
    const where = { order_status: { [Op.in]: ['completed', 'delivered'] } };

    if (start && end) {
      where.created_at = { [Op.between]: [new Date(start), new Date(end)] };
    }

    let groupFormat;
    if (period === 'month') groupFormat = '%Y-%m';
    else if (period === 'year') groupFormat = '%Y';
    else groupFormat = '%Y-%m-%d';

    const chartDataResult = await Order.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), groupFormat), 'date'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'revenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders']
      ],
      where,
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), groupFormat)],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), groupFormat), 'ASC']]
    });

    const chartData = chartDataResult.map(item => ({
      date: item.getDataValue('date'),
      revenue: parseFloat(item.getDataValue('revenue') || 0),
      orders: parseInt(item.getDataValue('orders') || 0)
    }));

    const salesData = await Order.findAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = chartData.reduce((sum, item) => sum + item.orders, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    res.json({ 
      success: true, 
      data: {
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue,
          customerCount: await User.count({ where: { role: 'customer' } })
        },
        chartData,
        salesData,
        total: await Order.count({ where })
      } 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Product Performance
 */
exports.getProductPerformance = async (req, res, next) => {
  try {
    const { 
      topSellingPage = 1, topSellingLimit = 10, 
      lowStockPage = 1, lowStockLimit = 10, 
      mostViewedPage = 1, mostViewedLimit = 10 
    } = req.query;

    const topSellingOffset = (parseInt(topSellingPage) - 1) * parseInt(topSellingLimit);
    const lowStockOffset = (parseInt(lowStockPage) - 1) * parseInt(lowStockLimit);
    const mostViewedOffset = (parseInt(mostViewedPage) - 1) * parseInt(mostViewedLimit);

    // Top Selling Products
    const topSelling = await OrderItem.findAll({
      attributes: [
        ['product_id', 'productId'],
        [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'unitsSold'],
        [sequelize.fn('SUM', sequelize.literal('OrderItem.quantity * OrderItem.price_at_purchase')), 'revenue']
      ],
      include: [{ 
        model: Product, 
        as: 'product', 
        attributes: ['name', 'sku', ['quantity', 'stock'], 'price', 'images'],
        include: [{
          model: Category,
          as: 'category',
          attributes: ['name']
        }]
      }],
      group: ['OrderItem.product_id', 'product.id', 'product.category.id'],
      order: [[sequelize.literal('unitsSold'), 'DESC']],
      limit: parseInt(topSellingLimit),
      offset: topSellingOffset,
      subQuery: false
    });

    const topSellingTotal = await OrderItem.count({
      distinct: true,
      col: 'product_id'
    });

    // Low Stock Products
    const lowStock = await Product.findAll({
      where: {
        quantity: { [Op.lte]: 10 },
        is_published: true // Assuming is_published instead of is_active based on model
      },
      attributes: ['id', 'name', 'sku', ['quantity', 'stock'], 'price', 'images'],
      order: [['quantity', 'ASC']],
      limit: parseInt(lowStockLimit),
      offset: lowStockOffset
    });

    const lowStockTotal = await Product.count({
      where: { quantity: { [Op.lte]: 10 }, is_published: true }
    });

    // Most Viewed Products
    const mostViewed = await Product.findAll({
      attributes: ['id', 'name', 'sku', ['quantity', 'stock'], 'price', 'images', 'views'],
      where: { is_published: true },
      order: [['views', 'DESC']],
      limit: parseInt(mostViewedLimit),
      offset: mostViewedOffset
    });

    const mostViewedTotal = await Product.count({ where: { is_published: true } });

    res.json({ 
      success: true, 
      data: {
        topSelling: topSelling.map(item => ({
          id: item.getDataValue('productId'),
          name: item.product?.name,
          sku: item.product?.sku,
          image: item.product?.images && item.product.images.length > 0 ? item.product.images[0] : null,
          category: item.product?.category?.name,
          unitsSold: parseInt(item.getDataValue('unitsSold') || 0),
          revenue: parseFloat(item.getDataValue('revenue') || 0),
          stock: item.product?.getDataValue('stock')
        })),
        lowStock: lowStock.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          image: p.images && p.images.length > 0 ? p.images[0] : null,
          stock: p.getDataValue('stock'),
          minStock: 10,
          price: p.price
        })),
        mostViewed: mostViewed.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          image: p.images && p.images.length > 0 ? p.images[0] : null,
          views: p.views || 0,
          unitsSold: 0, // We could calculate this if needed
          revenue: 0,
          stock: p.getDataValue('stock')
        })),
        topSellingTotal,
        lowStockTotal,
        mostViewedTotal,
        totalProducts: await Product.count({ where: { is_published: true } }),
        lowStockCount: lowStockTotal,
        totalViews: await Product.sum('views', { where: { is_published: true } }) || 0
      } 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller Performance
 */
exports.getSellerPerformance = async (req, res, next) => {
  try {
    const { 
      topSellersPage = 1, topSellersLimit = 10,
      ratingsPage = 1, ratingsLimit = 10,
      payoutPage = 1, payoutLimit = 10
    } = req.query;

    const topSellersOffset = (parseInt(topSellersPage) - 1) * parseInt(topSellersLimit);
    const ratingsOffset = (parseInt(ratingsPage) - 1) * parseInt(ratingsLimit);
    const payoutOffset = (parseInt(payoutPage) - 1) * parseInt(payoutLimit);

    // Platform-wide Summary
    const totalSellers = await Seller.count({ where: { approval_status: 'approved' } });
    
    const revenueResult = await OrderItem.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.literal('quantity * price_at_purchase')), 'totalRevenue']
      ],
      raw: true
    });
    const totalRevenue = parseFloat(revenueResult?.totalRevenue || 0);
    const totalCommission = totalRevenue * 0.10; // Assuming 10% platform fee

    // Top Sellers by Revenue
    const topSellers = await OrderItem.findAll({
      attributes: [
        ['seller_id', 'sellerId'],
        [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'productsSold'],
        [sequelize.fn('SUM', sequelize.literal('OrderItem.quantity * OrderItem.price_at_purchase')), 'totalRevenue'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('order_id'))), 'totalOrders']
      ],
      include: [{ 
        model: Seller, 
        as: 'seller', 
        attributes: ['store_name', 'store_logo', 'rating'] 
      }],
      group: ['OrderItem.seller_id', 'seller.id'],
      order: [[sequelize.literal('totalRevenue'), 'DESC']],
      limit: parseInt(topSellersLimit),
      offset: topSellersOffset,
      subQuery: false
    });

    const topSellersTotal = await OrderItem.count({
      distinct: true,
      col: 'seller_id'
    });

    // Seller Ratings
    const sellerRatings = await Seller.findAll({
      where: { approval_status: 'approved' },
      attributes: ['id', 'store_name', 'store_logo', 'rating', 'total_reviews', 'approval_status'],
      order: [['rating', 'DESC'], ['total_reviews', 'DESC']],
      limit: parseInt(ratingsLimit),
      offset: ratingsOffset
    });

    const ratingsTotal = totalSellers;

    // Derived Payout History (from delivered items)
    const payoutHistoryItems = await OrderItem.findAll({
      where: { status: 'delivered' },
      include: [{ 
        model: Seller, 
        as: 'seller', 
        attributes: ['store_name', 'store_logo'] 
      }],
      order: [['updated_at', 'DESC']],
      limit: parseInt(payoutLimit),
      offset: payoutOffset
    });

    const payoutTotal = await OrderItem.count({ where: { status: 'delivered' } });

    res.json({ 
      success: true, 
      data: {
        totalSellers,
        totalRevenue,
        totalCommission,
        pendingPayouts: 0, // Mocked for now
        topSellers: topSellers.map(item => ({
          id: item.getDataValue('sellerId'),
          businessName: item.seller?.store_name,
          logo: item.seller?.store_logo,
          totalRevenue: parseFloat(item.getDataValue('totalRevenue') || 0),
          totalOrders: parseInt(item.getDataValue('totalOrders') || 0),
          productsSold: parseInt(item.getDataValue('productsSold') || 0),
          averageRating: parseFloat(item.seller?.rating || 0)
        })),
        sellerRatings: sellerRatings.map(s => ({
          id: s.id,
          businessName: s.store_name,
          logo: s.store_logo,
          averageRating: parseFloat(s.rating || 0),
          totalReviews: s.total_reviews,
          positiveReviews: Math.round(s.total_reviews * 0.9), // Mocked ratio
          status: 'active'
        })),
        payoutHistory: payoutHistoryItems.map(item => {
          const amount = parseFloat(item.price_at_purchase) * item.quantity;
          const commission = amount * 0.10;
          return {
            id: item.id,
            businessName: item.seller?.store_name,
            logo: item.seller?.store_logo,
            payoutDate: item.updated_at,
            amount: amount,
            commission: commission,
            commissionRate: 10,
            netAmount: amount - commission,
            status: 'completed'
          };
        }),
        topSellersTotal,
        ratingsTotal,
        payoutTotal
      } 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export Report
 */
exports.exportReport = async (req, res, next) => {
  try {
    const { type } = req.query;
    let data = [];
    let filename = 'report.csv';
    let headers = '';

    if (type === 'sales') {
      const sales = await Order.findAll({
        attributes: ['order_number', 'total_amount', 'order_status', 'created_at'],
        include: [{ model: User, as: 'user', attributes: ['email'] }],
        limit: 1000
      });
      headers = 'Order Number,Amount,Status,Date,Customer Email\n';
      data = sales.map(s => `${s.order_number},${s.total_amount},${s.order_status},${s.created_at},${s.user ? s.user.email : 'N/A'}`);
      filename = 'sales_report.csv';
    } else {
      headers = 'ID,Name,Date\n';
      data = ['1,Test Report,2026-02-25'];
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.status(200).send(headers + data.join('\n'));
  } catch (error) {
    next(error);
  }
};
