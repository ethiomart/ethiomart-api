const express = require('express');
const router = express.Router();
const chapaService = require('../services/chapaService');
const { verifyToken, requireRole } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');
const verifyWebhookSignature = require('../middleware/verifyWebhookSignature');

/**
 * GET /api/chapa/payment-methods
 * Get list of available payment methods
 * Public endpoint
 */
router.get('/payment-methods', (req, res) => {
  try {
    const paymentMethods = chapaService.getPaymentMethods();
    
    res.status(200).json({
      success: true,
      message: 'Payment methods retrieved successfully',
      data: {
        paymentMethods,
        currency: 'ETB',
        testMode: process.env.CHAPA_TEST_MODE !== 'false'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment methods',
      error: error.message
    });
  }
});

/**
 * POST /api/chapa/callback
 * Webhook endpoint for Chapa payment callbacks
 * Public endpoint (Chapa will call this)
 * Task 8.1: Add POST /api/payments/callback route
 * Task 8.4: Add webhook signature verification middleware
 * 
 * Security: Webhook signature verification middleware validates that
 * requests are genuinely from Chapa before processing
 */
router.post('/callback', verifyWebhookSignature, paymentController.handleCallback);

/**
 * GET /api/chapa/return
 * Return URL endpoint for Chapa payment redirects
 * Public endpoint (Chapa will redirect customers here after payment)
 * Task 10.1: Add GET /api/payments/return route
 * 
 * This endpoint receives customers after they complete payment on Chapa's page.
 * It returns an HTML page that signals the Flutter WebView to close and
 * allows the app to poll for payment status.
 * 
 * Query Parameters:
 * - tx_ref: Transaction reference
 * - status: Payment status from Chapa (success, failed, cancelled)
 */
router.get('/return', paymentController.handleReturn);

/**
 * GET /api/chapa/payment-methods/:id
 * Get specific payment method details
 * Public endpoint
 */
router.get('/payment-methods/:id', (req, res) => {
  try {
    const { id } = req.params;
    const paymentMethod = chapaService.getPaymentMethodById(id);
    
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Payment method retrieved successfully',
      data: { paymentMethod }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment method',
      error: error.message
    });
  }
});

/**
 * POST /api/chapa/export-report
 * Export transaction report
 * Admin only
 */
router.post('/export-report', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    // Fetch transactions from database
    const { Payment } = require('../models');
    const transactions = await Payment.findAll({
      where: {
        createdAt: {
          [require('sequelize').Op.between]: [new Date(startDate), new Date(endDate)]
        }
      },
      include: [
        {
          model: require('../models').Order,
          as: 'order',
          include: [
            {
              model: require('../models').User,
              as: 'User',
              attributes: ['email', 'firstName', 'lastName']
            }
          ]
        }
      ]
    });
    
    // Format transactions for export
    const formattedTransactions = transactions.map(tx => ({
      createdAt: tx.createdAt,
      chapaReference: tx.chapaReference,
      orderId: tx.orderId,
      customerEmail: tx.order?.User?.email || 'N/A',
      amount: tx.amount,
      currency: 'ETB',
      status: tx.status,
      paymentMethod: tx.paymentMethod
    }));
    
    // Export report
    await chapaService.exportTransactionReport(
      new Date(startDate),
      new Date(endDate),
      formattedTransactions
    );
    
    res.status(200).json({
      success: true,
      message: 'Transaction report exported and sent to email',
      data: {
        totalTransactions: formattedTransactions.length,
        startDate,
        endDate
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to export report',
      error: error.message
    });
  }
});

module.exports = router;

