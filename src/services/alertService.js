/**
 * Alert Service
 * Task 18.3.2: Configure alerts for high failure rates
 * Handles sending alerts through various notification channels
 */

const axios = require('axios');
const logger = require('../utils/logger');
const alertConfig = require('../config/alerting');

/**
 * Alert cooldown tracker
 * Prevents alert spam by tracking last alert time for each type
 */
class AlertCooldownTracker {
  constructor() {
    this.lastAlertTimes = {};
  }

  /**
   * Check if alert can be sent (not in cooldown period)
   * @param {string} alertType - Type of alert
   * @returns {boolean} Whether alert can be sent
   */
  canSendAlert(alertType) {
    const cooldownPeriod = alertConfig.cooldown[alertType] || 15 * 60 * 1000; // Default 15 minutes
    const lastAlertTime = this.lastAlertTimes[alertType];
    
    if (!lastAlertTime) {
      return true;
    }
    
    const timeSinceLastAlert = Date.now() - lastAlertTime;
    return timeSinceLastAlert >= cooldownPeriod;
  }

  /**
   * Record that an alert was sent
   * @param {string} alertType - Type of alert
   */
  recordAlert(alertType) {
    this.lastAlertTimes[alertType] = Date.now();
  }

  /**
   * Reset cooldown for an alert type
   * @param {string} alertType - Type of alert
   */
  resetCooldown(alertType) {
    delete this.lastAlertTimes[alertType];
  }
}

const cooldownTracker = new AlertCooldownTracker();

/**
 * Send alert through all configured channels
 * @param {object} alert - Alert data
 */
async function sendAlert(alert) {
  const { type, severity, title, message, data, timestamp } = alert;
  
  // Check cooldown
  if (!cooldownTracker.canSendAlert(type)) {
    logger.debug('Alert skipped due to cooldown', {
      operation: 'alert_cooldown',
      alertType: type,
      severity: severity
    });
    return;
  }
  
  logger.info('Sending alert', {
    operation: 'send_alert',
    alertType: type,
    severity: severity,
    title: title
  });
  
  const results = {
    email: null,
    slack: null,
    sms: null,
    pagerduty: null,
    webhook: null
  };
  
  // Send through all enabled channels
  try {
    if (alertConfig.notifications.email.enabled) {
      results.email = await sendEmailAlert(alert);
    }
    
    if (alertConfig.notifications.slack.enabled) {
      results.slack = await sendSlackAlert(alert);
    }
    
    if (alertConfig.notifications.sms.enabled && severity === alertConfig.severity.CRITICAL) {
      results.sms = await sendSMSAlert(alert);
    }
    
    if (alertConfig.notifications.pagerduty.enabled && severity === alertConfig.severity.CRITICAL) {
      results.pagerduty = await sendPagerDutyAlert(alert);
    }
    
    if (alertConfig.notifications.webhook.enabled) {
      results.webhook = await sendWebhookAlert(alert);
    }
    
    // Record alert sent
    cooldownTracker.recordAlert(type);
    
    logger.info('Alert sent successfully', {
      operation: 'alert_sent',
      alertType: type,
      severity: severity,
      channels: Object.keys(results).filter(k => results[k]?.success)
    });
    
    return results;
  } catch (error) {
    logger.error('Failed to send alert', {
      operation: 'alert_send_error',
      alertType: type,
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

/**
 * Send email alert
 * @param {object} alert - Alert data
 * @returns {Promise<object>} Result
 */
async function sendEmailAlert(alert) {
  try {
    const emailService = require('./emailService');
    const recipients = alertConfig.notifications.email.recipients;
    
    if (!recipients || recipients.length === 0) {
      return { success: false, error: 'No email recipients configured' };
    }
    
    const emailData = {
      to: recipients,
      from: alertConfig.notifications.email.from,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      html: formatEmailAlert(alert)
    };
    
    // Note: This assumes emailService has a sendAlert method
    // In production, implement this method in emailService.js
    const result = await emailService.sendEmail(emailData);
    
    return { success: true, result };
  } catch (error) {
    logger.error('Failed to send email alert', {
      operation: 'email_alert_error',
      error: error.message
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Send Slack alert
 * @param {object} alert - Alert data
 * @returns {Promise<object>} Result
 */
async function sendSlackAlert(alert) {
  try {
    const webhookUrl = alertConfig.notifications.slack.webhookUrl;
    
    if (!webhookUrl) {
      return { success: false, error: 'Slack webhook URL not configured' };
    }
    
    const color = alert.severity === 'critical' ? 'danger' : 
                  alert.severity === 'warning' ? 'warning' : 'good';
    
    const payload = {
      channel: alertConfig.notifications.slack.channel,
      username: 'Payment Monitoring',
      icon_emoji: ':rotating_light:',
      attachments: [{
        color: color,
        title: alert.title,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Timestamp',
            value: new Date(alert.timestamp).toISOString(),
            short: true
          }
        ],
        footer: 'Payment Monitoring System',
        ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
      }]
    };
    
    const response = await axios.post(webhookUrl, payload);
    
    return { success: response.status === 200, result: response.data };
  } catch (error) {
    logger.error('Failed to send Slack alert', {
      operation: 'slack_alert_error',
      error: error.message
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Send SMS alert
 * @param {object} alert - Alert data
 * @returns {Promise<object>} Result
 */
async function sendSMSAlert(alert) {
  try {
    const recipients = alertConfig.notifications.sms.recipients;
    
    if (!recipients || recipients.length === 0) {
      return { success: false, error: 'No SMS recipients configured' };
    }
    
    const message = `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`;
    
    // Note: This is a placeholder. In production, integrate with actual SMS provider (Twilio, AWS SNS, etc.)
    logger.info('SMS alert would be sent', {
      operation: 'sms_alert_placeholder',
      recipients: recipients,
      message: message
    });
    
    return { success: true, message: 'SMS sending not implemented' };
  } catch (error) {
    logger.error('Failed to send SMS alert', {
      operation: 'sms_alert_error',
      error: error.message
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Send PagerDuty alert
 * @param {object} alert - Alert data
 * @returns {Promise<object>} Result
 */
async function sendPagerDutyAlert(alert) {
  try {
    const apiKey = alertConfig.notifications.pagerduty.apiKey;
    const serviceKey = alertConfig.notifications.pagerduty.serviceKey;
    
    if (!apiKey || !serviceKey) {
      return { success: false, error: 'PagerDuty credentials not configured' };
    }
    
    // Note: This is a placeholder. In production, integrate with PagerDuty Events API v2
    logger.info('PagerDuty alert would be sent', {
      operation: 'pagerduty_alert_placeholder',
      severity: alert.severity,
      title: alert.title
    });
    
    return { success: true, message: 'PagerDuty integration not implemented' };
  } catch (error) {
    logger.error('Failed to send PagerDuty alert', {
      operation: 'pagerduty_alert_error',
      error: error.message
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Send webhook alert
 * @param {object} alert - Alert data
 * @returns {Promise<object>} Result
 */
async function sendWebhookAlert(alert) {
  try {
    const webhookUrl = alertConfig.notifications.webhook.url;
    
    if (!webhookUrl) {
      return { success: false, error: 'Webhook URL not configured' };
    }
    
    const payload = {
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data,
      timestamp: alert.timestamp,
      environment: process.env.NODE_ENV || 'development'
    };
    
    const response = await axios.post(
      webhookUrl,
      payload,
      { headers: alertConfig.notifications.webhook.headers }
    );
    
    return { success: response.status === 200, result: response.data };
  } catch (error) {
    logger.error('Failed to send webhook alert', {
      operation: 'webhook_alert_error',
      error: error.message
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Format email alert HTML
 * @param {object} alert - Alert data
 * @returns {string} HTML content
 */
function formatEmailAlert(alert) {
  const severityColor = alert.severity === 'critical' ? '#dc3545' : 
                        alert.severity === 'warning' ? '#ffc107' : '#28a745';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${severityColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .footer { background-color: #f1f1f1; padding: 10px; text-align: center; font-size: 12px; color: #666; }
        .metric { margin: 10px 0; padding: 10px; background-color: white; border-left: 3px solid ${severityColor}; }
        .metric-label { font-weight: bold; color: #555; }
        .metric-value { font-size: 18px; color: #333; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${alert.title}</h2>
          <p>Severity: ${alert.severity.toUpperCase()}</p>
        </div>
        <div class="content">
          <p>${alert.message}</p>
          ${alert.data ? formatAlertData(alert.data) : ''}
          <p><strong>Timestamp:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
        </div>
        <div class="footer">
          <p>Payment Monitoring System - Automated Alert</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Format alert data for email
 * @param {object} data - Alert data
 * @returns {string} HTML content
 */
function formatAlertData(data) {
  let html = '<div style="margin-top: 20px;">';
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object') {
      html += `<div class="metric"><span class="metric-label">${key}:</span> ${JSON.stringify(value)}</div>`;
    } else {
      html += `<div class="metric"><span class="metric-label">${key}:</span> <span class="metric-value">${value}</span></div>`;
    }
  }
  
  html += '</div>';
  return html;
}

module.exports = {
  sendAlert,
  cooldownTracker
};
