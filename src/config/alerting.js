/**
 * Alerting Configuration
 * Task 18.3.2: Configure alerts for high failure rates
 * Defines alert thresholds and notification channels
 */

module.exports = {
  // Alert thresholds
  thresholds: {
    // Payment failure rate threshold (20%)
    paymentFailureRate: {
      critical: 0.20, // 20% failure rate triggers critical alert
      warning: 0.10,  // 10% failure rate triggers warning
      minSampleSize: 10 // Minimum number of payments before alerting
    },
    
    // Webhook delivery rate threshold (90%)
    webhookDeliveryRate: {
      critical: 0.90, // Below 90% triggers critical alert
      warning: 0.95,  // Below 95% triggers warning
      minSampleSize: 10
    },
    
    // Response time thresholds (milliseconds)
    responseTime: {
      critical: 5000, // 5 seconds
      warning: 3000,  // 3 seconds
      operation: {
        initialize: {
          critical: 5000,
          warning: 3000
        },
        verify: {
          critical: 5000,
          warning: 3000
        },
        webhook: {
          critical: 2000,
          warning: 1000
        }
      }
    },
    
    // Consecutive failures threshold
    consecutiveFailures: {
      critical: 5,  // 5 consecutive failures
      warning: 3    // 3 consecutive failures
    }
  },
  
  // Notification channels
  notifications: {
    // Email notifications
    email: {
      enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
      recipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
      from: process.env.ALERT_EMAIL_FROM || 'alerts@example.com'
    },
    
    // Slack notifications
    slack: {
      enabled: process.env.ALERT_SLACK_ENABLED === 'true',
      webhookUrl: process.env.ALERT_SLACK_WEBHOOK_URL,
      channel: process.env.ALERT_SLACK_CHANNEL || '#payment-alerts'
    },
    
    // SMS notifications (for critical alerts)
    sms: {
      enabled: process.env.ALERT_SMS_ENABLED === 'true',
      recipients: (process.env.ALERT_SMS_RECIPIENTS || '').split(',').filter(Boolean),
      provider: process.env.ALERT_SMS_PROVIDER || 'twilio'
    },
    
    // PagerDuty integration
    pagerduty: {
      enabled: process.env.ALERT_PAGERDUTY_ENABLED === 'true',
      apiKey: process.env.ALERT_PAGERDUTY_API_KEY,
      serviceKey: process.env.ALERT_PAGERDUTY_SERVICE_KEY
    },
    
    // Webhook notifications (generic)
    webhook: {
      enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
      url: process.env.ALERT_WEBHOOK_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.ALERT_WEBHOOK_AUTH_TOKEN ? `Bearer ${process.env.ALERT_WEBHOOK_AUTH_TOKEN}` : undefined
      }
    }
  },
  
  // Alert cooldown periods (in milliseconds)
  cooldown: {
    // Don't send same alert type more than once per period
    highFailureRate: 15 * 60 * 1000,      // 15 minutes
    lowWebhookDelivery: 15 * 60 * 1000,   // 15 minutes
    slowResponseTime: 30 * 60 * 1000,     // 30 minutes
    consecutiveFailures: 10 * 60 * 1000   // 10 minutes
  },
  
  // Alert severity levels
  severity: {
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info'
  },
  
  // Alert message templates
  templates: {
    highFailureRate: {
      title: 'High Payment Failure Rate Alert',
      message: (data) => `Payment failure rate is ${(data.failureRate * 100).toFixed(2)}% (threshold: ${(data.threshold * 100).toFixed(0)}%). Total payments: ${data.totalPayments}, Failed: ${data.failedPayments}, Successful: ${data.successfulPayments}.`
    },
    lowWebhookDelivery: {
      title: 'Low Webhook Delivery Rate Alert',
      message: (data) => `Webhook delivery rate is ${(data.deliveryRate * 100).toFixed(2)}% (threshold: ${(data.threshold * 100).toFixed(0)}%). Total webhooks: ${data.total}, Failed: ${data.failed}.`
    },
    slowResponseTime: {
      title: 'Slow Payment Response Time Alert',
      message: (data) => `Average response time is ${data.avgResponseTime.toFixed(0)}ms (threshold: ${data.threshold}ms). Operation: ${data.operation || 'all'}.`
    },
    consecutiveFailures: {
      title: 'Consecutive Payment Failures Alert',
      message: (data) => `${data.count} consecutive payment failures detected. Last failure: ${data.lastFailureReason}.`
    }
  }
};
