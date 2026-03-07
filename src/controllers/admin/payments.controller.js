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
      id: payment.id,
      transactionId: payment.transaction_id || payment.chapa_tx_ref,
      orderId: payment.order_id,
      orderNumber: payment.order?.order_number,
      amount: parseFloat(payment.amount),
      currency: payment.currency,
      paymentMethod: payment.payment_method,
      paymentStatus: payment.status,
      status: payment.status,
      createdAt: payment.created_at,
      customer: payment.order?.user ? {
        fullName: `${payment.order.user.first_name} ${payment.order.user.last_name}`,
        email: payment.order.user.email
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

    const formattedLogs = logs.map(payment => {
      let level = 'info';
      let message = `Payment of ${payment.amount} ${payment.currency} for order #${payment.order_id}`;
      
      if (payment.status === 'success') {
        level = 'success';
        message = `Successfully processed payment for order #${payment.order_id}`;
      } else if (payment.status === 'failed') {
        level = 'error';
        message = `Failed payment attempt for order #${payment.order_id}`;
      }

      return {
        id: payment.id,
        timestamp: payment.updated_at,
        transactionId: payment.chapa_tx_ref || payment.transaction_id || 'N/A',
        status: payment.status,
        level: level,
        message: message,
        errorDetails: payment.chapa_response?.message || payment.chapa_response?.error || '-',
        source: payment.payment_method || 'Chapa'
      };
    });
    res.json({ success: true, data: formattedLogs });
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
