/**
 * Monitoring Routes
 * Task 18.3: Monitoring Setup
 * Routes for payment monitoring and metrics
 */

const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const monitoringController = require('../controllers/monitoringController');

/**
 * @route   GET /api/monitoring/payments/metrics
 * @desc    Get payment metrics summary
 * @access  Admin only
 */
router.get(
  '/payments/metrics',
  verifyToken,
  requireRole(['admin']),
  monitoringController.getPaymentMetrics
);

/**
 * @route   GET /api/monitoring/payments/health
 * @desc    Get payment system health status
 * @access  Admin only
 */
router.get(
  '/payments/health',
  verifyToken,
  requireRole(['admin']),
  monitoringController.getPaymentHealth
);

/**
 * @route   GET /api/monitoring/payments/alerts
 * @desc    Get active payment alerts
 * @access  Admin only
 */
router.get(
  '/payments/alerts',
  verifyToken,
  requireRole(['admin']),
  monitoringController.getPaymentAlerts
);

module.exports = router;
