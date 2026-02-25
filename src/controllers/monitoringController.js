/**
 * Monitoring Controller
 * Task 18.3: Monitoring Setup
 * Provides endpoints for payment monitoring and metrics
 */

const paymentMetrics = require('../utils/paymentMonitoring');
const logger = require('../utils/logger');

/**
 * Get payment metrics summary
 * GET /api/monitoring/payments/metrics
 */
const getPaymentMetrics = async (req, res) => {
  try {
    const summary = paymentMetrics.getMetricsSummary();
    
    logger.debug('Payment metrics retrieved', {
      operation: 'get_payment_metrics',
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'Payment metrics retrieved successfully',
      data: summary
    });
  } catch (error) {
    logger.error('Failed to retrieve payment metrics', {
      operation: 'get_payment_metrics_error',
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment metrics',
      error: error.message
    });
  }
};

/**
 * Get payment health status
 * GET /api/monitoring/payments/health
 */
const getPaymentHealth = async (req, res) => {
  try {
    const summary = paymentMetrics.getMetricsSummary();
    
    // Determine health status based on metrics
    const failureRate = summary.failureRate;
    const webhookDeliveryRate = summary.webhookDeliveryRate;
    const avgResponseTime = summary.averageResponseTime;
    
    let status = 'healthy';
    const issues = [];
    
    // Check failure rate (threshold: 20%)
    if (failureRate > 0.2) {
      status = 'degraded';
      issues.push({
        type: 'high_failure_rate',
        severity: 'critical',
        message: `Payment failure rate is ${(failureRate * 100).toFixed(2)}% (threshold: 20%)`,
        value: failureRate,
        threshold: 0.2
      });
    } else if (failureRate > 0.1) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push({
        type: 'elevated_failure_rate',
        severity: 'warning',
        message: `Payment failure rate is ${(failureRate * 100).toFixed(2)}% (threshold: 10%)`,
        value: failureRate,
        threshold: 0.1
      });
    }
    
    // Check webhook delivery rate (threshold: 90%)
    if (webhookDeliveryRate < 0.9 && summary.webhookDeliveries.total > 10) {
      status = 'degraded';
      issues.push({
        type: 'low_webhook_delivery_rate',
        severity: 'critical',
        message: `Webhook delivery rate is ${(webhookDeliveryRate * 100).toFixed(2)}% (threshold: 90%)`,
        value: webhookDeliveryRate,
        threshold: 0.9
      });
    }
    
    // Check average response time (threshold: 3000ms)
    if (avgResponseTime > 3000) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push({
        type: 'slow_response_time',
        severity: 'warning',
        message: `Average response time is ${avgResponseTime.toFixed(0)}ms (threshold: 3000ms)`,
        value: avgResponseTime,
        threshold: 3000
      });
    }
    
    const healthData = {
      status: status,
      timestamp: new Date().toISOString(),
      metrics: {
        totalPayments: summary.totalPayments,
        successRate: summary.successRate,
        failureRate: summary.failureRate,
        webhookDeliveryRate: summary.webhookDeliveryRate,
        averageResponseTime: summary.averageResponseTime
      },
      issues: issues,
      uptime: process.uptime()
    };
    
    logger.debug('Payment health check performed', {
      operation: 'payment_health_check',
      status: status,
      issueCount: issues.length
    });
    
    res.status(200).json({
      success: true,
      message: 'Payment health status retrieved',
      data: healthData
    });
  } catch (error) {
    logger.error('Failed to check payment health', {
      operation: 'payment_health_check_error',
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to check payment health',
      error: error.message
    });
  }
};

/**
 * Get payment alerts
 * GET /api/monitoring/payments/alerts
 */
const getPaymentAlerts = async (req, res) => {
  try {
    const summary = paymentMetrics.getMetricsSummary();
    const alerts = [];
    
    // High failure rate alert
    if (summary.failureRate > 0.2) {
      alerts.push({
        id: `alert_failure_rate_${Date.now()}`,
        type: 'high_failure_rate',
        severity: 'critical',
        title: 'High Payment Failure Rate',
        message: `Payment failure rate is ${(summary.failureRate * 100).toFixed(2)}%`,
        threshold: 0.2,
        currentValue: summary.failureRate,
        timestamp: new Date().toISOString(),
        metrics: {
          totalPayments: summary.totalPayments,
          failedPayments: summary.failedPayments,
          successfulPayments: summary.successfulPayments
        }
      });
    }
    
    // Low webhook delivery rate alert
    if (summary.webhookDeliveryRate < 0.9 && summary.webhookDeliveries.total > 10) {
      alerts.push({
        id: `alert_webhook_delivery_${Date.now()}`,
        type: 'low_webhook_delivery_rate',
        severity: 'critical',
        title: 'Low Webhook Delivery Rate',
        message: `Webhook delivery rate is ${(summary.webhookDeliveryRate * 100).toFixed(2)}%`,
        threshold: 0.9,
        currentValue: summary.webhookDeliveryRate,
        timestamp: new Date().toISOString(),
        metrics: summary.webhookDeliveries
      });
    }
    
    // Slow response time alert
    if (summary.averageResponseTime > 5000) {
      alerts.push({
        id: `alert_slow_response_${Date.now()}`,
        type: 'slow_response_time',
        severity: 'warning',
        title: 'Slow Payment Response Time',
        message: `Average response time is ${summary.averageResponseTime.toFixed(0)}ms`,
        threshold: 5000,
        currentValue: summary.averageResponseTime,
        timestamp: new Date().toISOString(),
        metrics: {
          averageInitializeTime: summary.averageInitializeTime,
          averageVerifyTime: summary.averageVerifyTime,
          averageWebhookTime: summary.averageWebhookTime
        }
      });
    }
    
    logger.debug('Payment alerts retrieved', {
      operation: 'get_payment_alerts',
      alertCount: alerts.length,
      userId: req.user?.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Payment alerts retrieved',
      data: {
        alerts: alerts,
        count: alerts.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve payment alerts', {
      operation: 'get_payment_alerts_error',
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment alerts',
      error: error.message
    });
  }
};

module.exports = {
  getPaymentMetrics,
  getPaymentHealth,
  getPaymentAlerts
};
