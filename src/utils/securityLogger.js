/**
 * Security Event Logger
 * Logs security-related events for payment system monitoring and auditing
 * Requirement 11: Security and Validation - Logging for security events
 * Property 55: Secret Key Non-Exposure - Never log sensitive data
 */

const fs = require('fs');
const path = require('path');

// Security log levels
const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

// Security event types
const EVENT_TYPES = {
  PAYMENT_INIT: 'PAYMENT_INITIALIZATION',
  PAYMENT_VERIFY: 'PAYMENT_VERIFICATION',
  WEBHOOK_RECEIVED: 'WEBHOOK_RECEIVED',
  WEBHOOK_INVALID_SIGNATURE: 'WEBHOOK_INVALID_SIGNATURE',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  HTTPS_VIOLATION: 'HTTPS_VIOLATION',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILURE: 'PAYMENT_FAILURE',
  ORDER_CONFIRMATION: 'ORDER_CONFIRMATION',
  DUPLICATE_PAYMENT_ATTEMPT: 'DUPLICATE_PAYMENT_ATTEMPT'
};

/**
 * Sanitize data to remove sensitive information
 * Property 55: Secret Key Non-Exposure
 * @param {object} data - Data to sanitize
 * @returns {object} - Sanitized data
 */
function sanitizeData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };
  const sensitiveKeys = [
    'password',
    'secret',
    'secretKey',
    'apiKey',
    'token',
    'authorization',
    'CHAPA_SECRET_KEY',
    'CHAPA_WEBHOOK_SECRET',
    'JWT_SECRET',
    'cardNumber',
    'cvv',
    'pin'
  ];

  // Recursively sanitize nested objects
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive information
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  });

  return sanitized;
}

/**
 * Format log entry
 * @param {string} level - Log level
 * @param {string} eventType - Event type
 * @param {string} message - Log message
 * @param {object} metadata - Additional metadata
 * @returns {object} - Formatted log entry
 */
function formatLogEntry(level, eventType, message, metadata = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    eventType,
    message,
    metadata: sanitizeData(metadata),
    environment: process.env.NODE_ENV || 'development'
  };
}

/**
 * Write log to file (in production)
 * @param {object} logEntry - Log entry to write
 */
function writeToFile(logEntry) {
  // Only write to file in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    const logDir = path.join(__dirname, '../../logs');
    const logFile = path.join(logDir, 'security.log');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Append log entry to file
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('Failed to write security log to file:', error.message);
  }
}

/**
 * Log security event
 * @param {string} level - Log level
 * @param {string} eventType - Event type
 * @param {string} message - Log message
 * @param {object} metadata - Additional metadata
 */
function logSecurityEvent(level, eventType, message, metadata = {}) {
  const logEntry = formatLogEntry(level, eventType, message, metadata);

  // Always log to console
  const consoleMethod = level === LOG_LEVELS.ERROR || level === LOG_LEVELS.CRITICAL ? 'error' : 'log';
  console[consoleMethod](`[SECURITY] [${level}] [${eventType}] ${message}`, 
    metadata ? `\nMetadata: ${JSON.stringify(sanitizeData(metadata), null, 2)}` : ''
  );

  // Write to file in production
  writeToFile(logEntry);
}

/**
 * Log payment initialization
 * @param {object} data - Payment initialization data
 */
function logPaymentInitialization(data) {
  logSecurityEvent(
    LOG_LEVELS.INFO,
    EVENT_TYPES.PAYMENT_INIT,
    'Payment initialization requested',
    {
      orderId: data.orderId,
      amount: data.amount,
      currency: data.currency,
      email: data.email,
      userId: data.userId,
      ip: data.ip
    }
  );
}

/**
 * Log payment verification
 * @param {object} data - Payment verification data
 */
function logPaymentVerification(data) {
  logSecurityEvent(
    LOG_LEVELS.INFO,
    EVENT_TYPES.PAYMENT_VERIFY,
    'Payment verification requested',
    {
      reference: data.reference,
      status: data.status,
      userId: data.userId,
      ip: data.ip
    }
  );
}

/**
 * Log webhook received
 * @param {object} data - Webhook data
 */
function logWebhookReceived(data) {
  logSecurityEvent(
    LOG_LEVELS.INFO,
    EVENT_TYPES.WEBHOOK_RECEIVED,
    'Webhook callback received from Chapa',
    {
      txRef: data.txRef,
      status: data.status,
      amount: data.amount,
      ip: data.ip,
      hasSignature: !!data.signature
    }
  );
}

/**
 * Log invalid webhook signature
 * @param {object} data - Webhook data
 */
function logInvalidWebhookSignature(data) {
  logSecurityEvent(
    LOG_LEVELS.WARN,
    EVENT_TYPES.WEBHOOK_INVALID_SIGNATURE,
    'Webhook received with invalid signature - potential security threat',
    {
      txRef: data.txRef,
      ip: data.ip,
      providedSignature: data.signature ? '[PRESENT]' : '[MISSING]'
    }
  );
}

/**
 * Log amount mismatch
 * @param {object} data - Mismatch data
 */
function logAmountMismatch(data) {
  logSecurityEvent(
    LOG_LEVELS.ERROR,
    EVENT_TYPES.AMOUNT_MISMATCH,
    'Payment amount mismatch detected - potential fraud attempt',
    {
      paymentId: data.paymentId,
      reference: data.reference,
      expectedAmount: data.expectedAmount,
      receivedAmount: data.receivedAmount,
      difference: Math.abs(data.expectedAmount - data.receivedAmount)
    }
  );
}

/**
 * Log currency mismatch
 * @param {object} data - Mismatch data
 */
function logCurrencyMismatch(data) {
  logSecurityEvent(
    LOG_LEVELS.ERROR,
    EVENT_TYPES.CURRENCY_MISMATCH,
    'Payment currency mismatch detected - potential fraud attempt',
    {
      paymentId: data.paymentId,
      reference: data.reference,
      expectedCurrency: data.expectedCurrency,
      receivedCurrency: data.receivedCurrency
    }
  );
}

/**
 * Log rate limit exceeded
 * @param {object} data - Rate limit data
 */
function logRateLimitExceeded(data) {
  logSecurityEvent(
    LOG_LEVELS.WARN,
    EVENT_TYPES.RATE_LIMIT_EXCEEDED,
    'Rate limit exceeded - potential abuse',
    {
      endpoint: data.endpoint,
      userId: data.userId,
      ip: data.ip,
      limit: data.limit,
      windowMs: data.windowMs
    }
  );
}

/**
 * Log unauthorized access attempt
 * @param {object} data - Access attempt data
 */
function logUnauthorizedAccess(data) {
  logSecurityEvent(
    LOG_LEVELS.WARN,
    EVENT_TYPES.UNAUTHORIZED_ACCESS,
    'Unauthorized access attempt detected',
    {
      endpoint: data.endpoint,
      userId: data.userId,
      ip: data.ip,
      reason: data.reason
    }
  );
}

/**
 * Log HTTPS violation
 * @param {object} data - HTTPS violation data
 */
function logHTTPSViolation(data) {
  logSecurityEvent(
    LOG_LEVELS.ERROR,
    EVENT_TYPES.HTTPS_VIOLATION,
    'HTTPS requirement violated - insecure connection attempt',
    {
      endpoint: data.endpoint,
      protocol: data.protocol,
      ip: data.ip
    }
  );
}

/**
 * Log suspicious activity
 * @param {object} data - Suspicious activity data
 */
function logSuspiciousActivity(data) {
  logSecurityEvent(
    LOG_LEVELS.CRITICAL,
    EVENT_TYPES.SUSPICIOUS_ACTIVITY,
    'Suspicious activity detected - requires investigation',
    {
      description: data.description,
      userId: data.userId,
      ip: data.ip,
      details: data.details
    }
  );
}

/**
 * Log payment success
 * @param {object} data - Payment success data
 */
function logPaymentSuccess(data) {
  logSecurityEvent(
    LOG_LEVELS.INFO,
    EVENT_TYPES.PAYMENT_SUCCESS,
    'Payment completed successfully',
    {
      paymentId: data.paymentId,
      orderId: data.orderId,
      reference: data.reference,
      amount: data.amount,
      currency: data.currency,
      paymentMethod: data.paymentMethod
    }
  );
}

/**
 * Log payment failure
 * @param {object} data - Payment failure data
 */
function logPaymentFailure(data) {
  logSecurityEvent(
    LOG_LEVELS.WARN,
    EVENT_TYPES.PAYMENT_FAILURE,
    'Payment failed',
    {
      paymentId: data.paymentId,
      orderId: data.orderId,
      reference: data.reference,
      amount: data.amount,
      reason: data.reason
    }
  );
}

/**
 * Log order confirmation
 * @param {object} data - Order confirmation data
 */
function logOrderConfirmation(data) {
  logSecurityEvent(
    LOG_LEVELS.INFO,
    EVENT_TYPES.ORDER_CONFIRMATION,
    'Order confirmed after successful payment',
    {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      paymentId: data.paymentId,
      reference: data.reference,
      amount: data.amount
    }
  );
}

/**
 * Log duplicate payment attempt
 * @param {object} data - Duplicate payment data
 */
function logDuplicatePaymentAttempt(data) {
  logSecurityEvent(
    LOG_LEVELS.WARN,
    EVENT_TYPES.DUPLICATE_PAYMENT_ATTEMPT,
    'Duplicate payment attempt detected - idempotency check',
    {
      orderId: data.orderId,
      reference: data.reference,
      existingStatus: data.existingStatus,
      ip: data.ip
    }
  );
}

module.exports = {
  LOG_LEVELS,
  EVENT_TYPES,
  logSecurityEvent,
  logPaymentInitialization,
  logPaymentVerification,
  logWebhookReceived,
  logInvalidWebhookSignature,
  logAmountMismatch,
  logCurrencyMismatch,
  logRateLimitExceeded,
  logUnauthorizedAccess,
  logHTTPSViolation,
  logSuspiciousActivity,
  logPaymentSuccess,
  logPaymentFailure,
  logOrderConfirmation,
  logDuplicatePaymentAttempt,
  sanitizeData
};
