const { Payment, Order, User, OrderItem, Product, Seller } = require('../../models');
const { Op } = require('sequelize');

/**
 * Get all transactions with comprehensive details
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, order_id, tx_ref, dateFrom, dateTo } = req.query;
    const where = {};

    // Apply filters
    if (status) where.status = status;
    if (order_id) where.order_id = order_id;
    if (tx_ref) where.chapa_tx_ref = { [Op.like]: `%${tx_ref}%` };
    if (dateFrom && dateTo) {
      where.created_at = { [Op.between]: [new Date(dateFrom), new Date(dateTo)] };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows: transactions } = await Payment.findAndCountAll({
      where,
      include: [
        { 
          model: Order, 
          as: 'order', 
          attributes: ['id', 'order_number', 'total_amount', 'order_status', 'created_at'],
          include: [
            { 
              model: User, 
              as: 'user', 
              attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] 
            },
            {
              model: OrderItem,
              as: 'items',
              attributes: ['id', 'product_id', 'seller_id', 'quantity', 'price_at_purchase'],
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['id', 'name', 'sku', 'images']
                },
                {
                  model: Seller,
                  as: 'seller',
                  attributes: ['id', 'store_name', 'business_email']
                }
              ]
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']]
    });

    // Format the response with comprehensive transaction details
    const formattedTransactions = transactions.map(payment => ({
      // Payment fields - all fields from Payment model
      id: payment.id,
      order_id: payment.order_id,
      transaction_id: payment.transaction_id,
      chapa_tx_ref: payment.chapa_tx_ref,
      payment_method: payment.payment_method,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paid_at: payment.paid_at,
      refunded_at: payment.refunded_at,
      refund_reason: payment.refund_reason,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
      chapa_response: payment.chapa_response,
      payment_data: payment.payment_data,
      
      // Order details with full associations
      order: payment.order ? {
        id: payment.order.id,
        order_number: payment.order.order_number,
        total_amount: payment.order.total_amount,
        order_status: payment.order.order_status,
        created_at: payment.order.created_at,
        
        // Customer information
        customer: payment.order.user ? {
          id: payment.order.user.id,
          name: `${payment.order.user.first_name} ${payment.order.user.last_name}`,
          email: payment.order.user.email,
          phone: payment.order.user.phone
        } : null,
        
        // Order items with product and seller details
        items: payment.order.items ? payment.order.items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name,
          product_sku: item.product?.sku,
          product_image: item.product?.images?.[0] || null,
          quantity: item.quantity,
          price: item.price_at_purchase,
          
          // Seller information
          seller: item.seller ? {
            id: item.seller.id,
            store_name: item.seller.store_name,
            email: item.seller.business_email
          } : null
        })) : []
      } : null
    }));

    res.json({ 
      success: true, 
      data: {
        transactions: formattedTransactions,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transaction by ID
 */
exports.getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Payment.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }]
    });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment logs
 */
exports.getPaymentLogs = async (req, res, next) => {
  try {
    const logs = await Payment.findAll({
      limit: 50,
      order: [['updated_at', 'DESC']]
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

/**
 * Retry payment
 */
exports.retryPayment = async (req, res) => {
    res.json({ success: true, message: 'Payment retry initiated' });
};

/**
 * Manually verify a payment transaction
 * Calls Chapa's verification API and updates payment and order records
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.manualVerifyPayment = async (req, res, next) => {
  try {
    const { tx_ref } = req.body;
    const adminUserId = req.user?.id;
    const adminEmail = req.user?.email;

    // Validate input
    if (!tx_ref) {
      return res.status(400).json({
        success: false,
        message: 'Transaction reference (tx_ref) is required'
      });
    }

    // Log manual verification attempt
    console.log(`[Admin Manual Verification] Admin ${adminEmail} (ID: ${adminUserId}) initiating manual verification for tx_ref: ${tx_ref} at ${new Date().toISOString()}`);

    // Find payment by tx_ref
    const payment = await Payment.findOne({
      where: { chapa_tx_ref: tx_ref },
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'email', 'first_name', 'last_name']
            }
          ]
        }
      ]
    });

    if (!payment) {
      console.log(`[Admin Manual Verification] Payment not found for tx_ref: ${tx_ref}`);
      return res.status(404).json({
        success: false,
        message: 'Payment transaction not found',
        tx_ref
      });
    }

    // Import payment controller for verification logic
    const paymentController = require('../paymentController');
    
    // Create a mock request object with the reference parameter
    const mockReq = {
      params: { reference: tx_ref },
      user: req.user
    };

    // Create a custom response handler
    let verificationResult = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          verificationResult = { statusCode: code, ...data };
        }
      }),
      json: (data) => {
        verificationResult = { statusCode: 200, ...data };
      }
    };

    // Call the existing adminVerifyPayment function
    await paymentController.adminVerifyPayment(mockReq, mockRes);

    // Log verification result
    console.log(`[Admin Manual Verification] Verification completed for tx_ref: ${tx_ref} by admin ${adminEmail}. Status: ${verificationResult?.data?.payment?.status || 'unknown'}`);

    // Return the result
    if (verificationResult) {
      return res.status(verificationResult.statusCode || 200).json(verificationResult);
    } else {
      throw new Error('Verification failed to produce a result');
    }
  } catch (error) {
    console.error('[Admin Manual Verification] Error:', error);
    next(error);
  }
};
