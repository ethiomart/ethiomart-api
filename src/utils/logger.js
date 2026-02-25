/**
 * Logger Utility
 * Provides structured logging with different severity levels
 * Task 16.1.2: Add error logging with appropriate levels (ERROR, WARN, INFO, DEBUG)
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Get current log level from environment
 * @returns {string} Current log level
 */
const getCurrentLogLevel = () => {
  return process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');
};

/**
 * Check if a log level should be logged based on current log level
 * @param {string} level - Log level to check
 * @returns {boolean} Whether to log this level
 */
const shouldLog = (level) => {
  const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
  const currentLevel = getCurrentLogLevel();
  const currentIndex = levels.indexOf(currentLevel);
  const levelIndex = levels.indexOf(level);
  return levelIndex <= currentIndex;
};

/**
 * Format log message with timestamp and context
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} context - Additional context data
 * @returns {object} Formatted log object
 */
const formatLog = (level, message, context = {}) => {
  // Filter out sensitive data
  const sanitizedContext = sanitizeContext(context);
  
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizedContext,
    environment: process.env.NODE_ENV || 'development'
  };
};

/**
 * Sanitize context to remove sensitive data
 * @param {object} context - Context object
 * @returns {object} Sanitized context
 */
const sanitizeContext = (context) => {
  const sensitiveKeys = [
    'password',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'authorization',
    'CHAPA_SECRET_KEY',
    'CHAPA_WEBHOOK_SECRET',
    'EMAIL_PASS'
  ];
  
  const sanitized = { ...context };
  
  // Remove sensitive keys
  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  // Sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeContext(sanitized[key]);
    }
  }
  
  return sanitized;
};

/**
 * Log ERROR level message
 * Use for: Payment failures, verification failures, API errors, critical system errors
 * @param {string} message - Error message
 * @param {object} context - Additional context
 */
const error = (message, context = {}) => {
  if (!shouldLog(LOG_LEVELS.ERROR)) return;
  
  const log = formatLog(LOG_LEVELS.ERROR, message, context);
  console.error(JSON.stringify(log, null, 2));
};

/**
 * Log WARN level message
 * Use for: Retry attempts, timeout warnings, validation failures, deprecated features
 * @param {string} message - Warning message
 * @param {object} context - Additional context
 */
const warn = (message, context = {}) => {
  if (!shouldLog(LOG_LEVELS.WARN)) return;
  
  const log = formatLog(LOG_LEVELS.WARN, message, context);
  console.warn(JSON.stringify(log, null, 2));
};

/**
 * Log INFO level message
 * Use for: Payment initialization, successful verification, order confirmation, important business events
 * @param {string} message - Info message
 * @param {object} context - Additional context
 */
const info = (message, context = {}) => {
  if (!shouldLog(LOG_LEVELS.INFO)) return;
  
  const log = formatLog(LOG_LEVELS.INFO, message, context);
  console.log(JSON.stringify(log, null, 2));
};

/**
 * Log DEBUG level message
 * Use for: API request/response details, state transitions, detailed flow information
 * @param {string} message - Debug message
 * @param {object} context - Additional context
 */
const debug = (message, context = {}) => {
  if (!shouldLog(LOG_LEVELS.DEBUG)) return;
  
  const log = formatLog(LOG_LEVELS.DEBUG, message, context);
  console.log(JSON.stringify(log, null, 2));
};

/**
 * Log payment initialization
 * @param {object} data - Payment initialization data
 */
const logPaymentInitialization = (data) => {
  info('Payment initialization started', {
    operation: 'payment_initialization',
    orderId: data.orderId,
    amount: data.amount,
    currency: data.currency,
    email: data.email,
    userId: data.userId,
    ip: data.ip
  });
};

/**
 * Log payment success
 * @param {object} data - Payment success data
 */
const logPaymentSuccess = (data) => {
  info('Payment completed successfully', {
    operation: 'payment_success',
    paymentId: data.paymentId,
    orderId: data.orderId,
    reference: data.reference,
    amount: data.amount,
    currency: data.currency,
    paymentMethod: data.paymentMethod
  });
};

/**
 * Log payment failure
 * @param {object} data - Payment failure data
 */
const logPaymentFailure = (data) => {
  error('Payment failed', {
    operation: 'payment_failure',
    paymentId: data.paymentId,
    orderId: data.orderId,
    reference: data.reference,
    amount: data.amount,
    reason: data.reason
  });
};

/**
 * Log payment verification
 * @param {object} data - Verification data
 */
const logPaymentVerification = (data) => {
  info('Payment verification started', {
    operation: 'payment_verification',
    reference: data.reference,
    userId: data.userId,
    ip: data.ip
  });
};

/**
 * Log webhook received
 * @param {object} data - Webhook data
 */
const logWebhookReceived = (data) => {
  info('Webhook received from Chapa', {
    operation: 'webhook_received',
    txRef: data.txRef,
    status: data.status,
    amount: data.amount,
    ip: data.ip,
    hasSignature: !!data.signature
  });
};

/**
 * Log invalid webhook signature
 * @param {object} data - Webhook data
 */
const logInvalidWebhookSignature = (data) => {
  warn('Invalid webhook signature detected', {
    operation: 'invalid_webhook_signature',
    txRef: data.txRef,
    ip: data.ip,
    signaturePresent: data.signature === 'present'
  });
};

/**
 * Log amount mismatch
 * @param {object} data - Mismatch data
 */
const logAmountMismatch = (data) => {
  error('Amount mismatch detected in payment verification', {
    operation: 'amount_mismatch',
    paymentId: data.paymentId,
    reference: data.reference,
    expectedAmount: data.expectedAmount,
    receivedAmount: data.receivedAmount
  });
};

/**
 * Log currency mismatch
 * @param {object} data - Mismatch data
 */
const logCurrencyMismatch = (data) => {
  error('Currency mismatch detected in payment verification', {
    operation: 'currency_mismatch',
    paymentId: data.paymentId,
    reference: data.reference,
    expectedCurrency: data.expectedCurrency,
    receivedCurrency: data.receivedCurrency
  });
};

/**
 * Log order confirmation
 * @param {object} data - Order confirmation data
 */
const logOrderConfirmation = (data) => {
  info('Order confirmed after successful payment', {
    operation: 'order_confirmation',
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    paymentId: data.paymentId,
    reference: data.reference,
    amount: data.amount
  });
};

/**
 * Log duplicate payment attempt
 * @param {object} data - Duplicate payment data
 */
const logDuplicatePaymentAttempt = (data) => {
  warn('Duplicate payment attempt detected', {
    operation: 'duplicate_payment_attempt',
    orderId: data.orderId,
    reference: data.reference,
    existingStatus: data.existingStatus,
    ip: data.ip
  });
};

/**
 * Log email failure
 * @param {object} data - Email failure data
 */
const logEmailFailure = (data) => {
  warn('Email sending failed', {
    operation: 'email_failure',
    emailType: data.emailType,
    recipient: data.recipient,
    error: data.error,
    orderId: data.orderId,
    paymentId: data.paymentId
  });
};

/**
 * Log retry attempt
 * @param {object} data - Retry data
 */
const logRetryAttempt = (data) => {
  warn('Retrying operation', {
    operation: 'retry_attempt',
    attemptNumber: data.attemptNumber,
    maxAttempts: data.maxAttempts,
    operationType: data.operationType,
    reference: data.reference,
    error: data.error
  });
};

/**
 * Log API request
 * @param {object} data - Request data
 */
const logApiRequest = (data) => {
  debug('API request sent', {
    operation: 'api_request',
    method: data.method,
    url: data.url,
    service: data.service,
    reference: data.reference
  });
};

/**
 * Log API response
 * @param {object} data - Response data
 */
const logApiResponse = (data) => {
  debug('API response received', {
    operation: 'api_response',
    method: data.method,
    url: data.url,
    service: data.service,
    statusCode: data.statusCode,
    reference: data.reference,
    duration: data.duration
  });
};

/**
 * Log state transition
 * @param {object} data - State transition data
 */
const logStateTransition = (data) => {
  debug('State transition', {
    operation: 'state_transition',
    entity: data.entity,
    entityId: data.entityId,
    fromState: data.fromState,
    toState: data.toState,
    reason: data.reason
  });
};

module.exports = {
  LOG_LEVELS,
  error,
  warn,
  info,
  debug,
  logPaymentInitialization,
  logPaymentSuccess,
  logPaymentFailure,
  logPaymentVerification,
  logWebhookReceived,
  logInvalidWebhookSignature,
  logAmountMismatch,
  logCurrencyMismatch,
  logOrderConfirmation,
  logDuplicatePaymentAttempt,
  logEmailFailure,
  logRetryAttempt,
  logApiRequest,
  logApiResponse,
  logStateTransition
};
