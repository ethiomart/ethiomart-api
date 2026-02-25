/**
 * Payment Monitoring Utility
 * Task 18.3: Monitoring Setup
 * Provides payment success/failure rate monitoring and metrics tracking
 */

const logger = require('./logger');
const alertConfig = require('../config/alerting');

/**
 * In-memory metrics storage
 * In production, this should be replaced with a proper metrics service like Prometheus, CloudWatch, or Datadog
 */
class PaymentMetrics {
  constructor() {
    this.metrics = {
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      totalAmount: 0,
      successfulAmount: 0,
      failedAmount: 0,
      paymentsByMethod: {},
      paymentsByStatus: {},
      responseTimesMs: [],
      webhookDeliveries: {
        total: 0,
        successful: 0,
        failed: 0
      },
      lastResetTime: new Date()
    };
    
    // Reset metrics daily
    this.resetInterval = setInterval(() => {
      this.resetDailyMetrics();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Record payment initialization
   * @param {object} data - Payment data
   */
  recordPaymentInitialization(data) {
    this.metrics.totalPayments++;
    this.metrics.pendingPayments++;
    
    logger.debug('Payment initialization recorded', {
      operation: 'metrics_payment_init',
      orderId: data.orderId,
      amount: data.amount,
      totalPayments: this.metrics.totalPayments
    });
  }

  /**
   * Record payment success
   * @param {object} data - Payment success data
   */
  recordPaymentSuccess(data) {
    this.metrics.successfulPayments++;
    this.metrics.pendingPayments = Math.max(0, this.metrics.pendingPayments - 1);
    this.metrics.successfulAmount += parseFloat(data.amount) || 0;
    
    // Track by payment method
    const method = data.paymentMethod || 'unknown';
    this.metrics.paymentsByMethod[method] = (this.metrics.paymentsByMethod[method] || 0) + 1;
    
    // Track by status
    this.metrics.paymentsByStatus['success'] = (this.metrics.paymentsByStatus['success'] || 0) + 1;
    
    logger.info('Payment success recorded', {
      operation: 'metrics_payment_success',
      paymentId: data.paymentId,
      orderId: data.orderId,
      amount: data.amount,
      paymentMethod: method,
      successRate: this.getSuccessRate()
    });
  }

  /**
   * Record payment failure
   * @param {object} data - Payment failure data
   */
  recordPaymentFailure(data) {
    this.metrics.failedPayments++;
    this.metrics.pendingPayments = Math.max(0, this.metrics.pendingPayments - 1);
    this.metrics.failedAmount += parseFloat(data.amount) || 0;
    
    // Track by status
    this.metrics.paymentsByStatus['failed'] = (this.metrics.paymentsByStatus['failed'] || 0) + 1;
    
    const failureRate = this.getFailureRate();
    
    logger.warn('Payment failure recorded', {
      operation: 'metrics_payment_failure',
      paymentId: data.paymentId,
      orderId: data.orderId,
      amount: data.amount,
      reason: data.reason,
      failureRate: failureRate
    });
    
    // Check if failure rate is high
    if (failureRate > 0.2) { // 20% threshold
      this.triggerHighFailureRateAlert(failureRate);
    }
  }

  /**
   * Record payment response time
   * @param {number} durationMs - Duration in milliseconds
   * @param {string} operation - Operation type (initialize, verify, webhook)
   */
  async recordResponseTime(durationMs, operation) {
    this.metrics.responseTimesMs.push({
      duration: durationMs,
      operation: operation,
      timestamp: new Date()
    });
    
    // Keep only last 1000 response times
    if (this.metrics.responseTimesMs.length > 1000) {
      this.metrics.responseTimesMs.shift();
    }
    
    // Log slow operations
    const threshold = alertConfig.thresholds.responseTime.operation[operation]?.warning || 
                     alertConfig.thresholds.responseTime.warning;
    
    if (durationMs > threshold) {
      logger.warn('Slow payment operation detected', {
        operation: 'metrics_slow_operation',
        operationType: operation,
        durationMs: durationMs,
        threshold: threshold
      });
      
      // Check if average response time is consistently slow
      const avgResponseTime = this.getAverageResponseTime(operation);
      const criticalThreshold = alertConfig.thresholds.responseTime.operation[operation]?.critical || 
                               alertConfig.thresholds.responseTime.critical;
      
      if (avgResponseTime > criticalThreshold) {
        await this.triggerSlowResponseTimeAlert(avgResponseTime, operation);
      }
    }
  }

  /**
   * Record webhook delivery
   * @param {boolean} success - Whether webhook was delivered successfully
   * @param {object} data - Webhook data
   */
  async recordWebhookDelivery(success, data = {}) {
    this.metrics.webhookDeliveries.total++;
    
    if (success) {
      this.metrics.webhookDeliveries.successful++;
      logger.debug('Webhook delivery recorded as successful', {
        operation: 'metrics_webhook_success',
        txRef: data.txRef,
        deliveryRate: this.getWebhookDeliveryRate()
      });
    } else {
      this.metrics.webhookDeliveries.failed++;
      logger.warn('Webhook delivery recorded as failed', {
        operation: 'metrics_webhook_failure',
        txRef: data.txRef,
        reason: data.reason,
        deliveryRate: this.getWebhookDeliveryRate()
      });
      
      // Check if webhook delivery rate is low
      const deliveryRate = this.getWebhookDeliveryRate();
      const minSampleSize = alertConfig.thresholds.webhookDeliveryRate.minSampleSize;
      
      if (this.metrics.webhookDeliveries.total >= minSampleSize && 
          deliveryRate < alertConfig.thresholds.webhookDeliveryRate.critical) {
        await this.triggerLowWebhookDeliveryAlert(deliveryRate);
      }
    }
  }

  /**
   * Get payment success rate
   * @returns {number} Success rate (0-1)
   */
  getSuccessRate() {
    const completed = this.metrics.successfulPayments + this.metrics.failedPayments;
    if (completed === 0) return 0;
    return this.metrics.successfulPayments / completed;
  }

  /**
   * Get payment failure rate
   * @returns {number} Failure rate (0-1)
   */
  getFailureRate() {
    const completed = this.metrics.successfulPayments + this.metrics.failedPayments;
    if (completed === 0) return 0;
    return this.metrics.failedPayments / completed;
  }

  /**
   * Get webhook delivery rate
   * @returns {number} Delivery rate (0-1)
   */
  getWebhookDeliveryRate() {
    if (this.metrics.webhookDeliveries.total === 0) return 0;
    return this.metrics.webhookDeliveries.successful / this.metrics.webhookDeliveries.total;
  }

  /**
   * Get average response time
   * @param {string} operation - Optional operation filter
   * @returns {number} Average response time in milliseconds
   */
  getAverageResponseTime(operation = null) {
    let times = this.metrics.responseTimesMs;
    
    if (operation) {
      times = times.filter(t => t.operation === operation);
    }
    
    if (times.length === 0) return 0;
    
    const sum = times.reduce((acc, t) => acc + t.duration, 0);
    return sum / times.length;
  }

  /**
   * Get metrics summary
   * @returns {object} Metrics summary
   */
  getMetricsSummary() {
    return {
      totalPayments: this.metrics.totalPayments,
      successfulPayments: this.metrics.successfulPayments,
      failedPayments: this.metrics.failedPayments,
      pendingPayments: this.metrics.pendingPayments,
      successRate: this.getSuccessRate(),
      failureRate: this.getFailureRate(),
      totalAmount: this.metrics.totalAmount,
      successfulAmount: this.metrics.successfulAmount,
      failedAmount: this.metrics.failedAmount,
      paymentsByMethod: this.metrics.paymentsByMethod,
      paymentsByStatus: this.metrics.paymentsByStatus,
      averageResponseTime: this.getAverageResponseTime(),
      averageInitializeTime: this.getAverageResponseTime('initialize'),
      averageVerifyTime: this.getAverageResponseTime('verify'),
      averageWebhookTime: this.getAverageResponseTime('webhook'),
      webhookDeliveryRate: this.getWebhookDeliveryRate(),
      webhookDeliveries: this.metrics.webhookDeliveries,
      lastResetTime: this.metrics.lastResetTime,
      currentTime: new Date()
    };
  }

  /**
   * Trigger high failure rate alert
   * @param {number} failureRate - Current failure rate
   */
  async triggerHighFailureRateAlert(failureRate) {
    logger.error('HIGH FAILURE RATE ALERT', {
      operation: 'alert_high_failure_rate',
      failureRate: failureRate,
      threshold: alertConfig.thresholds.paymentFailureRate.critical,
      totalPayments: this.metrics.totalPayments,
      failedPayments: this.metrics.failedPayments,
      successfulPayments: this.metrics.successfulPayments,
      timestamp: new Date().toISOString()
    });
    
    // Send alert through notification channels
    try {
      const alertService = require('../services/alertService');
      
      const severity = failureRate > alertConfig.thresholds.paymentFailureRate.critical 
        ? alertConfig.severity.CRITICAL 
        : alertConfig.severity.WARNING;
      
      await alertService.sendAlert({
        type: 'highFailureRate',
        severity: severity,
        title: alertConfig.templates.highFailureRate.title,
        message: alertConfig.templates.highFailureRate.message({
          failureRate: failureRate,
          threshold: alertConfig.thresholds.paymentFailureRate.critical,
          totalPayments: this.metrics.totalPayments,
          failedPayments: this.metrics.failedPayments,
          successfulPayments: this.metrics.successfulPayments
        }),
        data: {
          failureRate: failureRate,
          threshold: alertConfig.thresholds.paymentFailureRate.critical,
          totalPayments: this.metrics.totalPayments,
          failedPayments: this.metrics.failedPayments,
          successfulPayments: this.metrics.successfulPayments,
          paymentsByMethod: this.metrics.paymentsByMethod
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send high failure rate alert', {
        operation: 'alert_send_error',
        error: error.message
      });
    }
  }

  /**
   * Trigger low webhook delivery rate alert
   * @param {number} deliveryRate - Current delivery rate
   */
  async triggerLowWebhookDeliveryAlert(deliveryRate) {
    logger.error('LOW WEBHOOK DELIVERY RATE ALERT', {
      operation: 'alert_low_webhook_delivery',
      deliveryRate: deliveryRate,
      threshold: alertConfig.thresholds.webhookDeliveryRate.critical,
      totalWebhooks: this.metrics.webhookDeliveries.total,
      failedWebhooks: this.metrics.webhookDeliveries.failed,
      successfulWebhooks: this.metrics.webhookDeliveries.successful,
      timestamp: new Date().toISOString()
    });
    
    // Send alert through notification channels
    try {
      const alertService = require('../services/alertService');
      
      await alertService.sendAlert({
        type: 'lowWebhookDelivery',
        severity: alertConfig.severity.CRITICAL,
        title: alertConfig.templates.lowWebhookDelivery.title,
        message: alertConfig.templates.lowWebhookDelivery.message({
          deliveryRate: deliveryRate,
          threshold: alertConfig.thresholds.webhookDeliveryRate.critical,
          total: this.metrics.webhookDeliveries.total,
          failed: this.metrics.webhookDeliveries.failed
        }),
        data: {
          deliveryRate: deliveryRate,
          threshold: alertConfig.thresholds.webhookDeliveryRate.critical,
          webhookDeliveries: this.metrics.webhookDeliveries
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send low webhook delivery alert', {
        operation: 'alert_send_error',
        error: error.message
      });
    }
  }

  /**
   * Trigger slow response time alert
   * @param {number} avgResponseTime - Average response time in milliseconds
   * @param {string} operation - Operation type
   */
  async triggerSlowResponseTimeAlert(avgResponseTime, operation) {
    logger.warn('SLOW RESPONSE TIME ALERT', {
      operation: 'alert_slow_response_time',
      avgResponseTime: avgResponseTime,
      operationType: operation,
      threshold: alertConfig.thresholds.responseTime.critical,
      timestamp: new Date().toISOString()
    });
    
    // Send alert through notification channels
    try {
      const alertService = require('../services/alertService');
      
      await alertService.sendAlert({
        type: 'slowResponseTime',
        severity: alertConfig.severity.WARNING,
        title: alertConfig.templates.slowResponseTime.title,
        message: alertConfig.templates.slowResponseTime.message({
          avgResponseTime: avgResponseTime,
          threshold: alertConfig.thresholds.responseTime.critical,
          operation: operation
        }),
        data: {
          avgResponseTime: avgResponseTime,
          threshold: alertConfig.thresholds.responseTime.critical,
          operation: operation,
          averageInitializeTime: this.getAverageResponseTime('initialize'),
          averageVerifyTime: this.getAverageResponseTime('verify'),
          averageWebhookTime: this.getAverageResponseTime('webhook')
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send slow response time alert', {
        operation: 'alert_send_error',
        error: error.message
      });
    }
  }

  /**
   * Reset daily metrics
   */
  resetDailyMetrics() {
    logger.info('Resetting daily payment metrics', {
      operation: 'metrics_reset',
      summary: this.getMetricsSummary()
    });
    
    // Archive current metrics before reset (in production, save to database or metrics service)
    const archivedMetrics = {
      ...this.getMetricsSummary(),
      archivedAt: new Date()
    };
    
    // Reset counters
    this.metrics = {
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      totalAmount: 0,
      successfulAmount: 0,
      failedAmount: 0,
      paymentsByMethod: {},
      paymentsByStatus: {},
      responseTimesMs: [],
      webhookDeliveries: {
        total: 0,
        successful: 0,
        failed: 0
      },
      lastResetTime: new Date()
    };
    
    return archivedMetrics;
  }

  /**
   * Cleanup interval on shutdown
   */
  cleanup() {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
    }
  }
}

// Singleton instance
const paymentMetrics = new PaymentMetrics();

// Cleanup on process exit
process.on('SIGTERM', () => {
  paymentMetrics.cleanup();
});

process.on('SIGINT', () => {
  paymentMetrics.cleanup();
});

module.exports = paymentMetrics;
