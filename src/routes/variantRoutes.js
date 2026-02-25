const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :productId from parent router
const variantController = require('../controllers/variantController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadVariantImage } = require('../middleware/upload');
const {
  validateCreateOptions,
  validateUpdateCombination,
  validateCombinationLimit,
  handleVariantValidationErrors
} = require('../middleware/variantValidation');

/**
 * Variant Routes
 * All routes are prefixed with /api/products/:productId/variants
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 8.6
 */

/**
 * POST /api/products/:productId/variants
 * Create variant options and values for a product
 * @access Private/Seller
 * @requirements 4.1, 4.6
 */
router.post(
  '/',
  verifyToken,
  requireRole(['seller']),
  validateCreateOptions,
  validateCombinationLimit,
  handleVariantValidationErrors,
  variantController.createVariantOptions
);

/**
 * POST /api/products/:productId/variants/generate
 * Generate all possible variant combinations
 * @access Private/Seller
 * @requirements 4.2, 4.6
 */
router.post(
  '/generate',
  verifyToken,
  requireRole(['seller']),
  variantController.generateVariantCombinations
);

/**
 * POST /api/products/:productId/variants/migrate
 * Migrate an existing product to support variants
 * @access Private/Seller
 * @requirements 13.1, 13.2, 13.3, 13.7
 */
router.post(
  '/migrate',
  verifyToken,
  requireRole(['seller']),
  validateCreateOptions,
  validateCombinationLimit,
  handleVariantValidationErrors,
  variantController.migrateProductToVariants
);

/**
 * GET /api/products/:productId/variants/stock
 * Get stock levels for all variants
 * @access Private/Seller
 * @requirements 8.6
 * 
 * Note: This route must come before /:variantId to avoid route conflicts
 */
router.get(
  '/stock',
  verifyToken,
  requireRole(['seller']),
  variantController.getVariantStock
);

/**
 * GET /api/products/:productId/variants
 * Get all variants for a product
 * @access Public (active variants) / Private (all variants for seller)
 * @requirements 4.3, 4.8
 */
router.get(
  '/',
  variantController.getProductVariants
);

/**
 * PUT /api/products/:productId/variants/:variantId
 * Update a specific variant combination
 * @access Private/Seller
 * @requirements 4.4, 4.6
 */
router.put(
  '/:variantId',
  verifyToken,
  requireRole(['seller']),
  validateUpdateCombination,
  handleVariantValidationErrors,
  variantController.updateVariantCombination
);

/**
 * DELETE /api/products/:productId/variants/:variantId
 * Delete a specific variant combination
 * @access Private/Seller
 * @requirements 4.5, 4.6
 */
router.delete(
  '/:variantId',
  verifyToken,
  requireRole(['seller']),
  variantController.deleteVariantCombination
);

/**
 * POST /api/products/:productId/variants/:variantId/image
 * Upload image for a variant combination
 * @access Private/Seller
 * @requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */
router.post(
  '/:variantId/image',
  verifyToken,
  requireRole(['seller']),
  uploadVariantImage,
  variantController.uploadVariantImage
);

module.exports = router;
