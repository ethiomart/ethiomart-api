const Seller = require('../models/Seller');
const User = require('../models/User');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const orderStatusService = require('../services/orderStatusService');
const { transformImageUrls } = require('../utils/imageUtils');
const { deleteFromCloudinary } = require('../utils/cloudinaryUtils');

/**
 * Create seller profile for authenticated user
 * @route POST /api/sellers/profile
 * @access Private/Seller
 */
const createSellerProfile = async (req, res, next) => {
  try {
    // Accept both old and new field names for backward compatibility
    const {
      businessName,
      store_name,
      businessDescription,
      store_description,
      businessAddress,
      business_address,
      phoneNumber,
      business_phone
    } = req.body;
    
    const userId = req.user.id;

    // Check if seller profile already exists
    const existingSeller = await Seller.findOne({ where: { userId } });
    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'Seller profile already exists'
      });
    }

    // Use new field names, fallback to old ones for compatibility
    const seller = await Seller.create({
      user_id: userId,
      store_name: store_name || businessName || 'My Store',
      store_slug: (store_name || businessName || 'my-store').toLowerCase().replace(/\s+/g, '-'),
      store_description: store_description || businessDescription,
      business_address: business_address || businessAddress,
      business_phone: business_phone || phoneNumber
    });

    res.status(201).json({
      success: true,
      message: 'Seller profile created successfully',
      data: {
        seller
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get own seller profile
 * @route GET /api/sellers/profile
 * @access Private/Seller
 */
const getSellerProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const seller = await Seller.findOne({
      where: { user_id: userId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name', 'role']
        }
      ]
    });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Format response with field name aliases for Flutter compatibility
    const sellerData = seller.toJSON();
    const formattedSeller = {
      ...sellerData,
      // Add camelCase aliases for Flutter
      businessName: sellerData.store_name,
      businessDescription: sellerData.store_description,
      businessAddress: sellerData.business_address,
      phoneNumber: sellerData.business_phone,
      logoUrl: transformImageUrls(req, sellerData.store_logo),
      approvalStatus: sellerData.approval_status,
      rejectionReason: sellerData.rejection_reason,
      // Keep snake_case for backward compatibility
      logo_url: transformImageUrls(req, sellerData.store_logo)
    };

    res.status(200).json({
      success: true,
      message: 'Seller profile retrieved successfully',
      data: formattedSeller
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update seller profile
 * @route PUT /api/sellers/profile
 * @access Private/Seller
 */
const updateSellerProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Accept both old and new field names for backward compatibility
    const {
      businessName,
      store_name,
      businessDescription,
      store_description,
      businessAddress,
      business_address,
      phoneNumber,
      business_phone
    } = req.body;

    const seller = await Seller.findOne({ where: { user_id: userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Update seller fields - use new field names, fallback to old ones
    const updateData = {};
    if (store_name !== undefined || businessName !== undefined) {
      updateData.store_name = store_name || businessName;
    }
    if (store_description !== undefined || businessDescription !== undefined) {
      updateData.store_description = store_description || businessDescription;
    }
    if (business_address !== undefined || businessAddress !== undefined) {
      updateData.business_address = business_address || businessAddress;
    }
    if (business_phone !== undefined || phoneNumber !== undefined) {
      updateData.business_phone = business_phone || phoneNumber;
    }

    await seller.update(updateData);

    res.status(200).json({
      success: true,
      message: 'Seller profile updated successfully',
      data: {
        seller
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload seller logo
 * @route POST /api/sellers/logo
 * @access Private/Seller
 */
const uploadLogo = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No logo file provided'
      });
    }

    // Get seller profile
    const seller = await Seller.findOne({ 
      where: { user_id: userId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name', 'role']
        }
      ]
    });
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Update seller with new logo URL
    const logoUrl = req.fileUrl; // Set by upload middleware
    
    // Delete old logo from Cloudinary if it exists
    if (seller.store_logo) {
      await deleteFromCloudinary(seller.store_logo);
    }
    
    await seller.update({ store_logo: logoUrl });

    // Reload to get updated data
    await seller.reload();

    // Format response with field name aliases for Flutter compatibility
    const sellerData = seller.toJSON();
    const formattedSeller = {
      ...sellerData,
      // Add camelCase aliases for Flutter
      businessName: sellerData.store_name,
      businessDescription: sellerData.store_description,
      businessAddress: sellerData.business_address,
      phoneNumber: sellerData.business_phone,
      logoUrl: sellerData.store_logo,
      approvalStatus: sellerData.approval_status,
      rejectionReason: sellerData.rejection_reason,
      // Keep snake_case for backward compatibility
      logo_url: sellerData.store_logo
    };

    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logoUrl: transformImageUrls(req, logoUrl),
        seller: formattedSeller
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get seller dashboard with sales statistics and order summaries
 * @route GET /api/sellers/dashboard
 * @access Private/Seller
 */
const getSellerDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get seller profile
    const seller = await Seller.findOne({ where: { user_id: userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Get total products count
    const totalProducts = await Product.count({
      where: { seller_id: seller.id }
    });

    // Get active products count
    const activeProducts = await Product.count({
      where: { seller_id: seller.id, is_published: true }
    });

    // Get low stock products count (quantity < 10)
    const lowStockProducts = await Product.count({
      where: { 
        seller_id: seller.id,
        quantity: { [Op.lt]: 10 }
      }
    });

    // Get total sales (sum of all order items for this seller)
    const totalSalesResult = await OrderItem.findOne({
      where: { seller_id: seller.id },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('price_at_purchase')), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalItemsSold']
      ],
      raw: true
    });

    const totalRevenue = parseFloat(totalSalesResult?.totalRevenue || 0);
    const totalItemsSold = parseInt(totalSalesResult?.totalItemsSold || 0);

    // Get total orders count (distinct orders)
    const totalOrders = await OrderItem.count({
      where: { seller_id: seller.id },
      distinct: true,
      col: 'order_id'
    });

    // Get order items count by status
    const orderStatusCounts = await OrderItem.findAll({
      where: { seller_id: seller.id },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const statusSummary = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };

    orderStatusCounts.forEach(item => {
      statusSummary[item.status] = parseInt(item.count);
    });

    // Get daily sales for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailySalesData = await OrderItem.findAll({
      where: {
        seller_id: seller.id,
        created_at: { [Op.gte]: sevenDaysAgo }
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('SUM', sequelize.col('price_at_purchase')), 'amount'],
        [sequelize.fn('COUNT', sequelize.literal('DISTINCT order_id')), 'orders']
      ],
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
      raw: true
    });

    // Format daily sales data
    const dailySales = dailySalesData.map(item => ({
      date: item.date,
      amount: parseFloat(item.amount || 0),
      orders: parseInt(item.orders || 0)
    }));

    // Get recent orders (last 10 order items for this seller)
    const recentOrders = await OrderItem.findAll({
      where: { seller_id: seller.id },
      include: [
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'user_id', 'total_amount', 'order_status', 'created_at']
        },
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: {
        totalSales: totalItemsSold,
        totalOrders: totalOrders,
        revenue: totalRevenue,
        totalProducts: totalProducts,
        pendingOrders: statusSummary.pending,
        lowStockProducts: lowStockProducts,
        dailySales: dailySales,
        statistics: {
          totalProducts,
          activeProducts,
          totalRevenue,
          totalItemsSold,
          orderStatusSummary: statusSummary
        },
        recentOrders
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get seller orders
 * @route GET /api/sellers/orders
 * @access Private/Seller
 */
const getSellerOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Add error logging for debugging
    console.log('[getSellerOrders] User ID:', userId);

    // Get seller profile
    const seller = await Seller.findOne({ where: { user_id: userId } });
    if (!seller) {
      console.log('[getSellerOrders] Seller profile not found for user:', userId);
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    console.log('[getSellerOrders] Seller ID:', seller.id);

    // Get all order items for this seller with null checks
    const orderItems = await OrderItem.findAll({
      where: { seller_id: seller.id },
      include: [
        {
          model: Order,
          as: 'order',
          required: false, // Allow null orders (shouldn't happen but prevents 500)
          attributes: ['id', 'user_id', 'total_amount', 'order_status', 'created_at', 'updated_at'],
          include: [
            {
              model: User,
              as: 'user',
              required: false, // Allow null users (shouldn't happen but prevents 500)
              attributes: ['id', 'email', 'first_name', 'last_name']
            }
          ]
        },
        {
          model: Product,
          as: 'product',
          required: false, // Allow null products (shouldn't happen but prevents 500)
          attributes: ['id', 'name', 'price', 'images']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    console.log('[getSellerOrders] Found order items:', orderItems.length);

    // Group order items by order_id with null checks
    const ordersMap = new Map();
    
    orderItems.forEach(item => {
      // Skip items with missing order data
      if (!item.order) {
        console.log('[getSellerOrders] Skipping item with missing order:', item.id);
        return;
      }

      const orderId = item.order_id;
      
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: item.order.id,
          user: item.order.user || null,
          total_amount: item.order.total_amount,
          order_status: item.order.order_status,
          created_at: item.order.created_at,
          updated_at: item.order.updated_at,
          items: []
        });
      }
      
      ordersMap.get(orderId).items.push({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product ? item.product.name : 'Unknown Product',
        product_image: (item.product && item.product.images) ? item.product.images[0] : null,
        quantity: item.quantity,
        price_at_purchase: item.price_at_purchase,
        status: item.status,
        created_at: item.created_at
      });
    });

    // Convert map to array
    const orders = Array.from(ordersMap.values());

    console.log('[getSellerOrders] Returning orders:', orders.length);

    res.status(200).json({
      success: true,
      message: 'Seller orders retrieved successfully',
      data: {
        orders
      }
    });
  } catch (error) {
    console.error('[getSellerOrders] Error:', error.message);
    console.error('[getSellerOrders] Stack:', error.stack);
    next(error);
  }
};

/**
 * Get seller earnings and transaction history
 * @route GET /api/sellers/earnings
 * @access Private/Seller
 */
const getEarnings = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get seller profile
    const seller = await Seller.findOne({ where: { user_id: userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Calculate total earnings from completed orders with successful payments
    // Use a subquery approach to avoid GROUP BY issues
    const completedOrderItems = await OrderItem.findAll({
      where: { 
        seller_id: seller.id,
        status: { [Op.in]: ['delivered', 'completed'] }
      },
      include: [
        {
          model: Order,
          as: 'order',
          required: true,
          attributes: ['id'],
          include: [
            {
              model: Payment,
              as: 'payment',
              required: true,
              attributes: ['status'],
              where: {
                status: { [Op.in]: ['success', 'verified'] }
              }
            }
          ]
        }
      ],
      attributes: ['price_at_purchase'],
      raw: true
    });

    const totalEarnings = completedOrderItems.reduce((sum, item) => 
      sum + parseFloat(item.price_at_purchase || 0), 0
    );

    // Calculate pending earnings (orders not yet delivered or not yet paid)
    const pendingOrderItems = await OrderItem.findAll({
      where: { 
        seller_id: seller.id,
        status: { [Op.in]: ['pending', 'confirmed', 'shipped'] }
      },
      attributes: ['price_at_purchase'],
      raw: true
    });

    // Also get delivered orders without successful payment
    const deliveredUnpaidItems = await OrderItem.findAll({
      where: { 
        seller_id: seller.id,
        status: { [Op.in]: ['delivered', 'completed'] }
      },
      include: [
        {
          model: Order,
          as: 'order',
          required: true,
          attributes: ['id'],
          include: [
            {
              model: Payment,
              as: 'payment',
              required: false,
              attributes: ['status']
            }
          ]
        }
      ],
      attributes: ['price_at_purchase'],
      raw: true
    });

    // Filter for items without payment or with non-successful payment
    const unpaidDelivered = deliveredUnpaidItems.filter(item => {
      const paymentStatus = item['order.payment.status'];
      return !paymentStatus || (paymentStatus !== 'success' && paymentStatus !== 'verified');
    });

    const pending = pendingOrderItems.reduce((sum, item) => 
      sum + parseFloat(item.price_at_purchase || 0), 0
    ) + unpaidDelivered.reduce((sum, item) => 
      sum + parseFloat(item.price_at_purchase || 0), 0
    );

    // For now, assume no withdrawals (this would come from a withdrawals table in production)
    const withdrawn = 0;
    const balance = totalEarnings - withdrawn;

    // Get transaction history (recent order items as transactions)
    const recentTransactions = await OrderItem.findAll({
      where: { seller_id: seller.id },
      include: [
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'order_number', 'total_amount', 'created_at'],
          include: [
            {
              model: Payment,
              as: 'payment',
              attributes: ['id', 'amount', 'currency', 'status', 'payment_method', 'chapa_tx_ref', 'paid_at', 'created_at'],
              required: false
            }
          ]
        },
        {
          model: Product,
          as: 'product',
          attributes: ['name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    // Format transactions with payment details
    const transactions = recentTransactions.map(item => {
      const payment = item.order?.payment;
      const itemAmount = parseFloat(item.price_at_purchase);
      const orderTotal = parseFloat(item.order?.total_amount || 0);
      
      // Calculate commission (assuming 10% platform fee, seller gets 90%)
      const commission = itemAmount * 0.10;
      const sellerEarnings = itemAmount - commission;

      // Determine if earnings are confirmed (order delivered AND payment successful)
      const isOrderDelivered = item.status === 'delivered' || item.status === 'completed';
      const isPaymentSuccessful = payment && (payment.status === 'success' || payment.status === 'verified');
      const earningsConfirmed = isOrderDelivered && isPaymentSuccessful;

      return {
        id: item.id.toString(),
        type: 'sale',
        amount: itemAmount,
        sellerEarnings: sellerEarnings,
        commission: commission,
        status: earningsConfirmed ? 'completed' : 'pending',
        earningsConfirmed: earningsConfirmed,
        createdAt: item.created_at,
        description: `Sale of ${item.product ? item.product.name : 'Unknown Product'}`,
        orderId: item.order_id.toString(),
        orderNumber: item.order?.order_number || '',
        orderTotal: orderTotal,
        // Payment details
        paymentStatus: payment?.status || 'pending',
        paymentAmount: payment ? parseFloat(payment.amount) : null,
        paymentCurrency: payment?.currency || 'ETB',
        paymentMethod: payment?.payment_method || null,
        paymentTxRef: payment?.chapa_tx_ref || null,
        paidAt: payment?.paid_at || null,
        paymentDate: payment?.created_at || null
      };
    });

    res.status(200).json({
      success: true,
      message: 'Earnings retrieved successfully',
      data: {
        balance,
        pending,
        withdrawn,
        totalEarnings,
        transactions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status (seller)
 * @route PUT /api/sellers/orders/:id/status
 * @access Private/Seller
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    const { status, trackingNumber, carrier, estimatedDelivery, notes } = req.body;

    // Get seller profile
    const seller = await Seller.findOne({ where: { user_id: userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Verify this seller has items in this order
    const hasItemsInOrder = await OrderItem.count({
      where: {
        order_id: orderId,
        seller_id: seller.id
      }
    });

    if (hasItemsInOrder === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this order'
      });
    }

    const updatedOrder = await orderStatusService.updateOrderStatus(
      orderId,
      status,
      { id: userId, role: 'seller' },
      { trackingNumber, carrier, estimatedDelivery, notes }
    );

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order: updatedOrder
      }
    });
  } catch (error) {
    if (error.message.includes('Invalid status transition') || error.message.includes('cannot set status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

module.exports = {
  createSellerProfile,
  getSellerProfile,
  updateSellerProfile,
  uploadLogo,
  getSellerDashboard,
  getSellerOrders,
  getEarnings,
  updateOrderStatus
};
