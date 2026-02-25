const { Order, User, OrderItem, Product, Seller, sequelize } = require('../../models');
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
    const { topSellingLimit = 10, lowStockLimit = 10, mostViewedLimit = 10 } = req.query;

    const topSelling = await OrderItem.findAll({
      attributes: [
        'productId',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'unitsSold'],
        [sequelize.fn('SUM', sequelize.literal('quantity * price')), 'revenue']
      ],
      include: [{ 
        model: Product, as: 'product', 
        attributes: ['name', 'sku', 'stock', 'price', 'main_image'] 
      }],
      group: ['productId'],
      order: [[sequelize.literal('unitsSold'), 'DESC']],
      limit: parseInt(topSellingLimit)
    });

    const lowStock = await Product.findAll({
      where: {
        stock: { [Op.lte]: 10 },
        is_active: true
      },
      attributes: ['id', 'name', 'sku', 'stock', 'price', 'main_image'],
      order: [['stock', 'ASC']],
      limit: parseInt(lowStockLimit)
    });

    const mostViewed = await Product.findAll({
      attributes: ['id', 'name', 'sku', 'stock', 'price', 'main_image', [sequelize.literal('0'), 'views']],
      order: [['created_at', 'DESC']],
      limit: parseInt(mostViewedLimit)
    });

    res.json({ 
      success: true, 
      data: {
        topSelling: topSelling.map(item => ({
          id: item.productId,
          name: item.product?.name,
          sku: item.product?.sku,
          image: item.product?.main_image,
          unitsSold: item.getDataValue('unitsSold'),
          revenue: item.getDataValue('revenue'),
          stock: item.product?.stock
        })),
        lowStock: lowStock.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          image: p.main_image,
          stock: p.stock,
          minStock: 10,
          price: p.price
        })),
        mostViewed: mostViewed.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          image: p.main_image,
          views: 0,
          unitsSold: 0,
          revenue: 0
        })),
        totalProducts: await Product.count({ where: { is_active: true } }),
        lowStockCount: await Product.count({ where: { stock: { [Op.lte]: 10 }, is_active: true } }),
        totalViews: 0
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
    const { limit = 20 } = req.query;
    
    const performance = await OrderItem.findAll({
      attributes: [
        'sellerId',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'unitsSold'],
        [sequelize.fn('SUM', sequelize.literal('quantity * price')), 'revenue'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('orderId'))), 'orderCount']
      ],
      include: [{ model: Seller, as: 'seller', attributes: ['store_name', 'logo'] }],
      group: ['sellerId'],
      order: [[sequelize.literal('revenue'), 'DESC']],
      limit: parseInt(limit)
    });

    res.json({ 
      success: true, 
      data: {
        sellers: performance.map(item => ({
          id: item.sellerId,
          storeName: item.seller?.store_name,
          logo: item.seller?.logo,
          unitsSold: item.getDataValue('unitsSold'),
          revenue: item.getDataValue('revenue'),
          orderCount: item.getDataValue('orderCount'),
          rating: 4.5
        })),
        totalSellers: await Seller.count({ where: { status: 'approved' } }),
        topSeller: performance[0]?.seller?.store_name || 'N/A'
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
