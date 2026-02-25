const { body, validationResult, oneOf } = require('express-validator');

/**
 * Middleware to normalize address field names from camelCase to snake_case
 * This allows the API to accept both formats from different clients
 */
const normalizeAddressFields = (req, res, next) => {
  if (req.body) {
    // Map camelCase to snake_case
    const fieldMap = {
      fullName: 'full_name',
      phoneNumber: 'phone_number',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      postalCode: 'postal_code',
      isDefault: 'is_default'
    };
    
    // Convert camelCase fields to snake_case
    Object.keys(fieldMap).forEach(camelKey => {
      if (req.body[camelKey] !== undefined) {
        req.body[fieldMap[camelKey]] = req.body[camelKey];
        delete req.body[camelKey];
      }
    });
  }
  next();
};

/**
 * Validation rules for user registration
 * Requirements: 11.1, 11.2, 11.4
 */
const validateRegistration = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .escape(),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .escape(),
  
  body('role')
    .optional()
    .trim()
    .isIn(['customer', 'seller', 'admin'])
    .withMessage('Role must be one of: customer, seller, admin')
    .escape()
];

/**
 * Validation rules for user login
 * Requirements: 11.1, 11.4
 */
const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Validation rules for product creation/update
 * Requirements: 11.3, 11.4
 */
const validateProduct = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .escape(),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Product description is required')
    .escape(),
  
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),
  
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  
  body('categoryId')
    .notEmpty()
    .withMessage('Category ID is required')
    .isInt()
    .withMessage('Category ID must be an integer')
];

/**
 * Validation rules for cart item addition/update
 * Requirements: 11.3, 11.4
 */
const validateCartItem = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isInt()
    .withMessage('Product ID must be an integer'),
  
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer')
];

/**
 * Validation rules for order creation
 * Requirements: 11.4
 */
const validateOrder = [
  body('shippingAddress')
    .notEmpty()
    .withMessage('Shipping address is required')
    .isObject()
    .withMessage('Shipping address must be an object'),
  
  body('shippingAddress.street')
    .trim()
    .notEmpty()
    .withMessage('Street address is required')
    .escape(),
  
  body('shippingAddress.city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .escape(),
  
  body('shippingAddress.state')
    .optional()
    .trim()
    .escape(),
  
  body('shippingAddress.postalCode')
    .trim()
    .notEmpty()
    .withMessage('Postal code is required')
    .escape(),
  
  body('shippingAddress.country')
    .trim()
    .notEmpty()
    .withMessage('Country is required')
    .escape()
];

/**
 * Validation rules for product review
 * Requirements: 11.3, 11.4
 */
const validateReview = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isInt()
    .withMessage('Product ID must be an integer'),
  
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),
  
  body('comment')
    .trim()
    .notEmpty()
    .withMessage('Comment is required')
    .escape()
];

/**
 * Validation rules for wishlist item
 * Requirements: 8.5
 */
const validateWishlistItem = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer')
];

/**
 * Validation rules for seller registration
 * Requirements: 1.2, 1.4
 */
const validateSellerRegistration = [
  body('storeName')
    .trim()
    .notEmpty()
    .withMessage('Store name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Store name must be between 3 and 100 characters')
    .escape(),
  
  body('businessEmail')
    .trim()
    .isEmail()
    .withMessage('Invalid business email format')
    .normalizeEmail(),
  
  body('businessPhone')
    .trim()
    .notEmpty()
    .withMessage('Business phone is required')
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/)
    .withMessage('Invalid phone number format'),
  
  body('businessAddress')
    .trim()
    .notEmpty()
    .withMessage('Business address is required')
    .escape(),
  
  body('taxId')
    .optional()
    .trim()
    .escape()
];

/**
 * Validation rules for address creation/update
 * Requirements: 2.1, 2.3
 */
const validateAddress = [
  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .escape(),
  
  body('phone_number')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/)
    .withMessage('Invalid phone number format')
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters'),
  
  body('address_line1')
    .trim()
    .notEmpty()
    .withMessage('Address line 1 is required')
    .isLength({ min: 5, max: 255 })
    .withMessage('Address line 1 must be between 5 and 255 characters')
    .escape(),
  
  body('address_line2')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Address line 2 must not exceed 255 characters')
    .escape(),
  
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters')
    .escape(),
  
  body('state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters')
    .escape(),
  
  body('postal_code')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postal code must not exceed 20 characters')
    .escape(),
  
  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country must not exceed 100 characters')
    .escape(),
  
  body('is_default')
    .optional()
    .isBoolean()
    .withMessage('is_default must be a boolean value'),
  
  body('type')
    .optional()
    .trim()
    .isIn(['shipping', 'billing'])
    .withMessage('Type must be either "shipping" or "billing"')
];

/**
 * Middleware to enforce HTTPS in production
 * Requirement 11.8: HTTPS URL Enforcement
 * Property 51: HTTPS-only communication
 */
const enforceHTTPS = (req, res, next) => {
  // Skip in development/test environments
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return next();
  }

  // Check if request is secure
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  
  if (!isSecure) {
    return res.status(403).json({
      success: false,
      message: 'HTTPS required',
      error: 'This endpoint requires a secure HTTPS connection'
    });
  }

  next();
};

/**
 * Validate that callback and return URLs use HTTPS
 * Requirement 11.8: HTTPS URL Enforcement
 * Property 51: HTTPS-only communication
 */
const validateHTTPSUrls = (req, res, next) => {
  // Skip in development/test environments
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return next();
  }

  const callbackUrl = process.env.PAYMENT_CALLBACK_URL;
  const returnUrl = process.env.PAYMENT_RETURN_URL;

  // Validate callback URL uses HTTPS
  if (callbackUrl && !callbackUrl.startsWith('https://')) {
    console.error('Security Error: PAYMENT_CALLBACK_URL must use HTTPS in production');
    return res.status(500).json({
      success: false,
      message: 'Configuration error',
      error: 'Payment system is not properly configured for secure communication'
    });
  }

  // Validate return URL uses HTTPS
  if (returnUrl && !returnUrl.startsWith('https://')) {
    console.error('Security Error: PAYMENT_RETURN_URL must use HTTPS in production');
    return res.status(500).json({
      success: false,
      message: 'Configuration error',
      error: 'Payment system is not properly configured for secure communication'
    });
  }

  next();
};

/**
 * Middleware to normalize payment field names from camelCase to snake_case
 * This allows the API to accept both formats from different clients (Flutter uses camelCase)
 * Requirements: 2.2, 2.3, 2.4, 3.5
 */
const normalizePaymentFields = (req, res, next) => {
  if (req.body) {
    // Map both camelCase and snake_case to the format expected by backend
    // Accept both formats for flexibility with different clients
    const fieldMap = {
      // snake_case to camelCase (backend uses camelCase)
      order_id: 'orderId',
      first_name: 'firstName',
      last_name: 'lastName',
      phone_number: 'phoneNumber',
    };
    
    // Convert snake_case fields to camelCase if present
    Object.keys(fieldMap).forEach(snakeKey => {
      if (req.body[snakeKey] !== undefined) {
        req.body[fieldMap[snakeKey]] = req.body[snakeKey];
        delete req.body[snakeKey];
      }
    });
    
    // camelCase fields are already in the correct format, no conversion needed
  }
  next();
};

/**
 * Validation rules for payment initialization
 * Requirements: 11.1, 11.2, 11.3, 11.4
 * Property 3: Amount precision (max 2 decimal places)
 * Property 44: Positive amount validation
 * Property 45: Currency validation
 * Property 46: Email format validation
 */
const validatePaymentInitialization = [
  normalizePaymentFields,
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .isInt({ min: 1 })
    .withMessage('Order ID must be a positive integer'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number')
    .custom((value) => {
      // Validate max 2 decimal places
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        throw new Error('Amount must have maximum 2 decimal places');
      }
      return true;
    }),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Invalid email address format')
    .normalizeEmail(),
  
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters')
    .escape(),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters')
    .escape(),
  
  body('phoneNumber')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/)
    .withMessage('Invalid phone number format')
    .escape(),
  
  body('currency')
    .optional()
    .trim()
    .toUpperCase()
    .isIn(['ETB', 'USD'])
    .withMessage('Currency must be ETB or USD')
];

/**
 * Validation rules for webhook payload
 * Requirements: 11.4, 11.6
 * Property 12: Callback parameter extraction
 */
const validateWebhookPayload = [
  body('tx_ref')
    .trim()
    .notEmpty()
    .withMessage('Transaction reference is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Transaction reference must be between 1 and 255 characters'),
  
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['success', 'failed', 'pending', 'cancelled'])
    .withMessage('Status must be one of: success, failed, pending, cancelled'),
  
  body('amount')
    .optional()
    .isString()
    .withMessage('Amount must be a string')
    .custom((value) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0) {
        throw new Error('Amount must be a valid positive number');
      }
      return true;
    }),
  
  body('currency')
    .optional()
    .trim()
    .toUpperCase()
    .isIn(['ETB', 'USD'])
    .withMessage('Currency must be ETB or USD'),
  
  body('ref_id')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Reference ID must not exceed 255 characters')
];

/**
 * Middleware to handle validation errors
 * Checks validation results and returns 400 with field-specific errors if validation fails
 * Requirements: 12.5
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Get the first error for user-friendly message
    const firstError = errors.array()[0];
    const field = firstError.path || firstError.param;
    const message = firstError.msg;
    
    // Format errors consistently for frontend parsing
    return res.status(400).json({
      success: false,
      message: message, // User-friendly message
      error: message, // Same as message for compatibility
      field: field, // Field that caused the error
      details: errors.array().reduce((acc, error) => {
        const fieldName = error.path || error.param;
        if (!acc[fieldName]) {
          acc[fieldName] = [];
        }
        acc[fieldName].push(error.msg);
        return acc;
      }, {})
    });
  }
  
  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateProduct,
  validateCartItem,
  validateOrder,
  validateReview,
  validateWishlistItem,
  validateSellerRegistration,
  validateAddress,
  validatePaymentInitialization,
  validateWebhookPayload,
  normalizeAddressFields,
  normalizePaymentFields,
  handleValidationErrors,
  enforceHTTPS,
  validateHTTPSUrls
};
