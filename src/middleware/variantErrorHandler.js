/**
 * Variant Error Handler
 * Specialized error handling for product variant operations
 * Task 14: Backend Error Handling
 * Requirements: 4.9, 12.9
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Variant-specific error codes
 */
const VARIANT_ERROR_CODES = {
  // Validation Errors (400)
  INVALID_VARIANT_OPTIONS: 'INVALID_VARIANT_OPTIONS',
  INVALID_VARIANT_VALUES: 'INVALID_VARIANT_VALUES',
  INVALID_OPTION_NAME: 'INVALID_OPTION_NAME',
  INVALID_VALUE_NAME: 'INVALID_VALUE_NAME',
  INVALID_SKU_FORMAT: 'INVALID_SKU_FORMAT',
  INVALID_PRICE: 'INVALID_PRICE',
  INVALID_STOCK_QUANTITY: 'INVALID_STOCK_QUANTITY',
  INVALID_POSITION: 'INVALID_POSITION',
  MISSING_VARIANT_DATA: 'MISSING_VARIANT_DATA',
  
  // Business Logic Errors (400)
  TOO_MANY_OPTIONS: 'TOO_MANY_OPTIONS',
  TOO_MANY_COMBINATIONS: 'TOO_MANY_COMBINATIONS',
  NO_ACTIVE_VARIANTS: 'NO_ACTIVE_VARIANTS',
  INVALID_COMBINATION_COUNT: 'INVALID_COMBINATION_COUNT',
  DUPLICATE_OPTION_POSITION: 'DUPLICATE_OPTION_POSITION',
  DUPLICATE_VALUE_POSITION: 'DUPLICATE_VALUE_POSITION',
  
  // Authorization Errors (403)
  PRODUCT_NOT_OWNED: 'PRODUCT_NOT_OWNED',
  UNAUTHORIZED_VARIANT_ACCESS: 'UNAUTHORIZED_VARIANT_ACCESS',
  
  // Not Found Errors (404)
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  VARIANT_NOT_FOUND: 'VARIANT_NOT_FOUND',
  VARIANT_OPTION_NOT_FOUND: 'VARIANT_OPTION_NOT_FOUND',
  VARIANT_VALUE_NOT_FOUND: 'VARIANT_VALUE_NOT_FOUND',
  VARIANT_COMBINATION_NOT_FOUND: 'VARIANT_COMBINATION_NOT_FOUND',
  CATEGORY_TEMPLATE_NOT_FOUND: 'CATEGORY_TEMPLATE_NOT_FOUND',
  
  // Conflict Errors (409)
  DUPLICATE_SKU: 'DUPLICATE_SKU',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  VARIANT_ALREADY_EXISTS: 'VARIANT_ALREADY_EXISTS',
  STOCK_RESERVATION_CONFLICT: 'STOCK_RESERVATION_CONFLICT',
  
  // Database Errors (500)
  VARIANT_DATABASE_ERROR: 'VARIANT_DATABASE_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  CASCADE_DELETE_FAILED: 'CASCADE_DELETE_FAILED'
};

/**
 * Create a variant-specific error
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Error code from VARIANT_ERROR_CODES
 * @param {Object} details - Additional error details
 * @returns {Error} Custom error object
 */
const createVariantError = (message, statusCode, errorCode, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.details = details;
  error.requestId = uuidv4();
  error.timestamp = new Date().toISOString();
  return error;
};

/**
 * Validation error handler
 * Handles express-validator validation errors
 * Returns 400 with detailed field errors
 */
const handleValidationError = (errors) => {
  const fieldErrors = errors.array().map(err => ({
    field: err.param,
    message: err.msg,
    value: err.value,
    location: err.location
  }));

  return createVariantError(
    'Validation failed',
    400,
    VARIANT_ERROR_CODES.MISSING_VARIANT_DATA,
    { fields: fieldErrors }
  );
};

/**
 * Business logic error handler
 * Handles variant-specific business rule violations
 * Returns 400 with descriptive message
 */
const handleBusinessLogicError = (type, details = {}) => {
  const errorMap = {
    TOO_MANY_OPTIONS: {
      message: 'Maximum 3 variant options allowed per product',
      code: VARIANT_ERROR_CODES.TOO_MANY_OPTIONS
    },
    TOO_MANY_COMBINATIONS: {
      message: 'Maximum 100 variant combinations allowed per product',
      code: VARIANT_ERROR_CODES.TOO_MANY_COMBINATIONS
    },
    NO_ACTIVE_VARIANTS: {
      message: 'At least one active variant combination is required',
      code: VARIANT_ERROR_CODES.NO_ACTIVE_VARIANTS
    },
    DUPLICATE_OPTION_POSITION: {
      message: 'Variant option positions must be unique within a product',
      code: VARIANT_ERROR_CODES.DUPLICATE_OPTION_POSITION
    },
    DUPLICATE_VALUE_POSITION: {
      message: 'Variant value positions must be unique within an option',
      code: VARIANT_ERROR_CODES.DUPLICATE_VALUE_POSITION
    }
  };

  const errorInfo = errorMap[type] || {
    message: 'Business logic validation failed',
    code: VARIANT_ERROR_CODES.INVALID_VARIANT_OPTIONS
  };

  return createVariantError(errorInfo.message, 400, errorInfo.code, details);
};

/**
 * Authorization error handler
 * Handles product ownership and permission errors
 * Returns 403 with descriptive message
 */
const handleAuthorizationError = (type, details = {}) => {
  const errorMap = {
    PRODUCT_NOT_OWNED: {
      message: 'You do not have permission to modify this product',
      code: VARIANT_ERROR_CODES.PRODUCT_NOT_OWNED
    },
    UNAUTHORIZED_VARIANT_ACCESS: {
      message: 'You do not have permission to access these variants',
      code: VARIANT_ERROR_CODES.UNAUTHORIZED_VARIANT_ACCESS
    }
  };

  const errorInfo = errorMap[type] || {
    message: 'Unauthorized access',
    code: VARIANT_ERROR_CODES.UNAUTHORIZED_VARIANT_ACCESS
  };

  return createVariantError(errorInfo.message, 403, errorInfo.code, details);
};

/**
 * Not found error handler
 * Handles missing resource errors
 * Returns 404 with descriptive message
 */
const handleNotFoundError = (type, details = {}) => {
  const errorMap = {
    PRODUCT_NOT_FOUND: {
      message: 'Product not found',
      code: VARIANT_ERROR_CODES.PRODUCT_NOT_FOUND
    },
    VARIANT_NOT_FOUND: {
      message: 'Variant not found',
      code: VARIANT_ERROR_CODES.VARIANT_NOT_FOUND
    },
    VARIANT_COMBINATION_NOT_FOUND: {
      message: 'Variant combination not found',
      code: VARIANT_ERROR_CODES.VARIANT_COMBINATION_NOT_FOUND
    },
    CATEGORY_TEMPLATE_NOT_FOUND: {
      message: 'Category template not found',
      code: VARIANT_ERROR_CODES.CATEGORY_TEMPLATE_NOT_FOUND
    }
  };

  const errorInfo = errorMap[type] || {
    message: 'Resource not found',
    code: VARIANT_ERROR_CODES.VARIANT_NOT_FOUND
  };

  return createVariantError(errorInfo.message, 404, errorInfo.code, details);
};

/**
 * Stock conflict error handler
 * Handles stock availability and reservation conflicts
 * Returns 409 with descriptive message
 */
const handleStockConflictError = (type, details = {}) => {
  const errorMap = {
    DUPLICATE_SKU: {
      message: 'SKU already exists. Please use a unique SKU.',
      code: VARIANT_ERROR_CODES.DUPLICATE_SKU
    },
    INSUFFICIENT_STOCK: {
      message: 'Insufficient stock available for this variant',
      code: VARIANT_ERROR_CODES.INSUFFICIENT_STOCK
    },
    STOCK_RESERVATION_CONFLICT: {
      message: 'Stock reservation conflict. Please try again.',
      code: VARIANT_ERROR_CODES.STOCK_RESERVATION_CONFLICT
    }
  };

  const errorInfo = errorMap[type] || {
    message: 'Resource conflict',
    code: VARIANT_ERROR_CODES.VARIANT_ALREADY_EXISTS
  };

  return createVariantError(errorInfo.message, 409, errorInfo.code, details);
};

/**
 * Database error handler
 * Handles database operation errors
 * Returns 500 with generic message (hides details in production)
 */
const handleDatabaseError = (error, operation = 'database operation') => {
  // Log the actual error for debugging
  console.error('Database Error:', {
    operation,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Return generic error to client
  const message = process.env.NODE_ENV === 'production'
    ? 'An error occurred while processing your request'
    : `Database error during ${operation}: ${error.message}`;

  return createVariantError(
    message,
    500,
    VARIANT_ERROR_CODES.VARIANT_DATABASE_ERROR,
    process.env.NODE_ENV === 'production' ? {} : { operation, originalError: error.message }
  );
};

/**
 * Log error with request ID for tracking
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 */
const logVariantError = (error, req) => {
  const logData = {
    requestId: error.requestId || uuidv4(),
    timestamp: error.timestamp || new Date().toISOString(),
    errorCode: error.errorCode,
    statusCode: error.statusCode,
    message: error.message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    productId: req.params?.productId,
    variantId: req.params?.variantId,
    details: error.details
  };

  // Determine log level based on status code
  if (error.statusCode >= 500) {
    console.error('[VARIANT ERROR]', logData);
    if (error.stack) {
      console.error('[STACK TRACE]', error.stack);
    }
  } else if (error.statusCode >= 400) {
    console.warn('[VARIANT WARNING]', logData);
  } else {
    console.log('[VARIANT INFO]', logData);
  }

  return logData.requestId;
};

/**
 * Format error response for client
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @returns {Object} Formatted error response
 */
const formatVariantErrorResponse = (error, req) => {
  const requestId = logVariantError(error, req);

  const response = {
    success: false,
    message: error.message,
    error: error.errorCode || VARIANT_ERROR_CODES.VARIANT_DATABASE_ERROR,
    requestId
  };

  // Include details in development mode
  if (process.env.NODE_ENV !== 'production') {
    if (error.details && Object.keys(error.details).length > 0) {
      response.details = error.details;
    }
    if (error.stack) {
      response.stack = error.stack;
    }
  } else {
    // In production, only include safe details
    if (error.details && error.details.fields) {
      response.details = { fields: error.details.fields };
    }
  }

  return response;
};

/**
 * Variant error middleware
 * Catches variant-specific errors and formats responses
 */
const variantErrorMiddleware = (err, req, res, next) => {
  // Check if this is a variant-related error
  const isVariantError = err.errorCode && Object.values(VARIANT_ERROR_CODES).includes(err.errorCode);

  if (isVariantError) {
    const response = formatVariantErrorResponse(err, req);
    return res.status(err.statusCode || 500).json(response);
  }

  // Pass to general error handler
  next(err);
};

module.exports = {
  VARIANT_ERROR_CODES,
  createVariantError,
  handleValidationError,
  handleBusinessLogicError,
  handleAuthorizationError,
  handleNotFoundError,
  handleStockConflictError,
  handleDatabaseError,
  logVariantError,
  formatVariantErrorResponse,
  variantErrorMiddleware
};
