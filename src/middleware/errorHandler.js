/**
 * Error Handler Middleware
 * Centralized error handling for the application
 * Task 16.1.1: Implement structured error responses
 * Task 14: Enhanced with variant error handling and request ID logging
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Error codes for consistent error identification
 */
const ERROR_CODES = {
  // Validation Errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_CURRENCY: 'INVALID_CURRENCY',
  INVALID_EMAIL: 'INVALID_EMAIL',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_TRANSACTION_REFERENCE: 'INVALID_TRANSACTION_REFERENCE',
  
  // Authentication Errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_WEBHOOK_SIGNATURE: 'INVALID_WEBHOOK_SIGNATURE',
  MISSING_AUTHORIZATION: 'MISSING_AUTHORIZATION',
  
  // Authorization Errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Resource Not Found Errors (404)
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  
  // Conflict Errors (409)
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  ORDER_ALREADY_PAID: 'ORDER_ALREADY_PAID',
  PAYMENT_ALREADY_COMPLETED: 'PAYMENT_ALREADY_COMPLETED',
  DUPLICATE_TRANSACTION: 'DUPLICATE_TRANSACTION',
  
  // Payment Errors (400/502)
  PAYMENT_INITIALIZATION_FAILED: 'PAYMENT_INITIALIZATION_FAILED',
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  PAYMENT_DECLINED: 'PAYMENT_DECLINED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  
  // External Service Errors (502/503)
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  PAYMENT_SERVICE_UNAVAILABLE: 'PAYMENT_SERVICE_UNAVAILABLE',
  CHAPA_API_ERROR: 'CHAPA_API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_TIMEOUT: 'SERVICE_TIMEOUT',
  
  // Internal Server Errors (500)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  
  // Variant-specific errors (imported from variantErrorHandler)
  // These are added for reference but actual handling is in variantErrorHandler
  INVALID_VARIANT_OPTIONS: 'INVALID_VARIANT_OPTIONS',
  DUPLICATE_SKU: 'DUPLICATE_SKU',
  TOO_MANY_COMBINATIONS: 'TOO_MANY_COMBINATIONS',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK'
};

/**
 * Centralized error handler middleware
 * Catches all errors and formats them as JSON responses
 * Maps error types to appropriate HTTP status codes
 * Logs errors with appropriate levels (ERROR, WARN, INFO, DEBUG)
 * Hides sensitive information in production
 * Includes request ID for error tracking
 */
const errorHandler = (err, req, res, next) => {
  // Generate unique request ID for tracking
  const requestId = err.requestId || uuidv4();
  
  // Default to 500 Internal Server Error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = err.errorCode || ERROR_CODES.INTERNAL_SERVER_ERROR;
  let retryable = false;
  
  // Map specific error types to status codes and error codes
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    errorCode = ERROR_CODES.VALIDATION_ERROR;
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Authentication failed';
    errorCode = ERROR_CODES.UNAUTHORIZED;
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = ERROR_CODES.TOKEN_EXPIRED;
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
    errorCode = ERROR_CODES.FORBIDDEN;
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
    errorCode = ERROR_CODES.RESOURCE_NOT_FOUND;
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Database validation error';
    errorCode = ERROR_CODES.VALIDATION_ERROR;
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Resource already exists';
    errorCode = ERROR_CODES.RESOURCE_CONFLICT;
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Invalid reference';
    errorCode = ERROR_CODES.VALIDATION_ERROR;
  } else if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'Database error';
    errorCode = ERROR_CODES.DATABASE_ERROR;
  }
  
  // Check for payment-specific errors
  if (err.message && err.message.includes('Chapa')) {
    statusCode = 502;
    message = 'Payment service temporarily unavailable';
    errorCode = ERROR_CODES.PAYMENT_SERVICE_UNAVAILABLE;
    retryable = true;
  } else if (err.message && err.message.includes('amount mismatch')) {
    statusCode = 400;
    message = 'Payment verification failed';
    errorCode = ERROR_CODES.AMOUNT_MISMATCH;
  } else if (err.message && err.message.includes('currency mismatch')) {
    statusCode = 400;
    message = 'Payment verification failed';
    errorCode = ERROR_CODES.CURRENCY_MISMATCH;
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    errorCode = ERROR_CODES.SERVICE_TIMEOUT;
    retryable = true;
  }

  // Determine log level based on status code
  const logLevel = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
  
  // Log error with appropriate level and request ID
  const logData = {
    requestId,
    level: logLevel,
    timestamp: new Date().toISOString(),
    errorCode,
    statusCode,
    message: err.message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    ...(logLevel === 'ERROR' && { stack: err.stack })
  };
  
  if (logLevel === 'ERROR') {
    console.error('ERROR:', logData);
  } else if (logLevel === 'WARN') {
    console.warn('WARN:', logData);
  } else {
    console.log('INFO:', logData);
  }

  // Prepare structured error response
  const errorResponse = {
    success: false,
    message,
    error: errorCode,
    requestId,
    ...(retryable && { retryable: true })
  };

  // Include additional error details in development mode
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.details = err.message;
    errorResponse.stack = err.stack;
    
    // Include validation errors if present
    if (err.errors) {
      errorResponse.validationErrors = err.errors;
    }
  } else {
    // In production, only include safe error details
    // Hide sensitive information like stack traces
    if (statusCode === 500) {
      errorResponse.message = 'Internal server error';
      errorResponse.details = 'An unexpected error occurred. Please contact support.';
    }
  }

  // Send JSON error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Create a custom error with error code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Error code from ERROR_CODES
 * @returns {Error} Custom error object
 */
const createError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
};

/**
 * 404 Not Found handler middleware
 * Handles requests to undefined routes
 * Returns consistent error format
 */
const notFoundHandler = (req, res, next) => {
  const error = {
    success: false,
    message: 'Route not found',
    error: ERROR_CODES.RESOURCE_NOT_FOUND,
    path: req.originalUrl,
    method: req.method
  };

  res.status(404).json(error);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  createError,
  ERROR_CODES
};
