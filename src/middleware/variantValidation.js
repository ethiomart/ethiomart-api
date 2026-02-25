const { body, validationResult } = require('express-validator');

/**
 * Validation rules for creating variant options
 * Requirements: 12.1, 12.2, 12.7, 12.8
 * 
 * Validates:
 * - Option names (1-50 chars)
 * - Value names (1-100 chars)
 * - Position uniqueness
 * - Array structure
 */
const validateCreateOptions = [
  body('options')
    .isArray({ min: 1, max: 3 })
    .withMessage('Options must be an array with 1 to 3 items'),
  
  body('options.*.option_name')
    .trim()
    .notEmpty()
    .withMessage('Option name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Option name must be between 1 and 50 characters')
    .escape(),
  
  body('options.*.option_position')
    .isInt({ min: 1, max: 3 })
    .withMessage('Option position must be an integer between 1 and 3'),
  
  body('options.*.values')
    .isArray({ min: 1 })
    .withMessage('Each option must have at least one value'),
  
  body('options.*.values.*.value_name')
    .trim()
    .notEmpty()
    .withMessage('Value name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Value name must be between 1 and 100 characters')
    .escape(),
  
  body('options.*.values.*.value_position')
    .isInt({ min: 1 })
    .withMessage('Value position must be a positive integer'),
  
  // Custom validation for position uniqueness
  body('options').custom((options) => {
    // Check option position uniqueness
    const optionPositions = options.map(opt => opt.option_position);
    const uniqueOptionPositions = new Set(optionPositions);
    if (optionPositions.length !== uniqueOptionPositions.size) {
      throw new Error('Option positions must be unique');
    }
    
    // Check value position uniqueness within each option
    options.forEach((option, optIndex) => {
      const valuePositions = option.values.map(val => val.value_position);
      const uniqueValuePositions = new Set(valuePositions);
      if (valuePositions.length !== uniqueValuePositions.size) {
        throw new Error(`Value positions must be unique within option at index ${optIndex}`);
      }
    });
    
    return true;
  })
];

/**
 * Validation rules for updating variant combination
 * Requirements: 12.3, 12.4, 12.5
 * 
 * Validates:
 * - SKU format (1-100 chars, alphanumeric + hyphens)
 * - Price (positive, max 2 decimals)
 * - Stock quantity (non-negative integer)
 * - Image URL format
 * - Active status boolean
 */
const validateUpdateCombination = [
  body('sku')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('SKU cannot be empty if provided')
    .isLength({ min: 1, max: 100 })
    .withMessage('SKU must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9-]+$/)
    .withMessage('SKU must contain only alphanumeric characters and hyphens'),
  
  body('price')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number')
    .custom((value) => {
      // Validate max 2 decimal places
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        throw new Error('Price must have maximum 2 decimal places');
      }
      return true;
    }),
  
  body('stock_quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock quantity must be a non-negative integer'),
  
  body('image_url')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Image URL must not exceed 500 characters')
    .custom((value) => {
      // Allow empty string or valid URL
      if (value === '') return true;
      
      // Basic URL validation
      try {
        new URL(value);
        return true;
      } catch (err) {
        // Also allow relative paths
        if (value.startsWith('/')) {
          return true;
        }
        throw new Error('Image URL must be a valid URL or relative path');
      }
    }),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean value')
];

/**
 * Validation rules for batch update of combinations
 * Requirements: 12.3, 12.4, 12.5
 * 
 * Validates multiple combinations at once
 */
const validateBatchUpdateCombinations = [
  body('combinations')
    .isArray({ min: 1 })
    .withMessage('Combinations must be an array with at least one item'),
  
  body('combinations.*.id')
    .isInt({ min: 1 })
    .withMessage('Combination ID must be a positive integer'),
  
  body('combinations.*.sku')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('SKU cannot be empty if provided')
    .isLength({ min: 1, max: 100 })
    .withMessage('SKU must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9-]+$/)
    .withMessage('SKU must contain only alphanumeric characters and hyphens'),
  
  body('combinations.*.price')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number')
    .custom((value) => {
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        throw new Error('Price must have maximum 2 decimal places');
      }
      return true;
    }),
  
  body('combinations.*.stock_quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock quantity must be a non-negative integer'),
  
  body('combinations.*.is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean value')
];

/**
 * Validation rules for variant migration
 * Requirements: 13.1, 13.2, 13.3
 * 
 * Validates migration of existing products to variant system
 */
const validateVariantMigration = [
  body('migrateData')
    .optional()
    .isBoolean()
    .withMessage('migrateData must be a boolean value'),
  
  body('preserveProductId')
    .optional()
    .isBoolean()
    .withMessage('preserveProductId must be a boolean value')
];

/**
 * Middleware to handle validation errors for variant operations
 * Returns 400 with descriptive error messages
 * Requirements: 12.9
 */
const handleVariantValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Get the first error for user-friendly message
    const firstError = errors.array()[0];
    const field = firstError.path || firstError.param;
    const message = firstError.msg;
    
    // Format errors consistently
    return res.status(400).json({
      success: false,
      message: `Validation failed: ${message}`,
      error: message,
      field: field,
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

/**
 * Custom middleware to validate combination limit
 * Requirements: 3.4, 3.5
 * 
 * Ensures total combinations don't exceed 100
 */
const validateCombinationLimit = (req, res, next) => {
  if (req.body.options && Array.isArray(req.body.options)) {
    // Calculate total combinations using Cartesian product
    const totalCombinations = req.body.options.reduce((total, option) => {
      return total * (option.values ? option.values.length : 1);
    }, 1);
    
    if (totalCombinations > 100) {
      return res.status(400).json({
        success: false,
        message: 'Combination limit exceeded',
        error: `Total combinations (${totalCombinations}) exceeds maximum limit of 100`,
        field: 'options',
        details: {
          totalCombinations,
          maxAllowed: 100
        }
      });
    }
  }
  
  next();
};

/**
 * Middleware to validate at least one active variant exists
 * Requirements: 12.6
 * 
 * This should be called after database operations to ensure
 * the product has at least one active variant
 */
const validateActiveVariantExists = async (req, res, next) => {
  // This validation is performed at the service layer
  // This middleware is a placeholder for route-level checks
  next();
};

module.exports = {
  validateCreateOptions,
  validateUpdateCombination,
  validateBatchUpdateCombinations,
  validateVariantMigration,
  validateCombinationLimit,
  validateActiveVariantExists,
  handleVariantValidationErrors
};
