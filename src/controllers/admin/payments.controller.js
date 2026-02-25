const { Payment, Order } = require('../../models');

/**
 * Get all transactions
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const transactions = await Payment.findAll({
      include: [{ model: Order, as: 'order', attributes: ['order_number', 'total_amount'] }],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: transactions });
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
