const variantService = require('../services/variantService');
const variantAnalyticsService = require('../services/variantAnalyticsService');
const Product = require('../models/Product');
const Seller = require('../models/Seller');

/**
 * Variant Controller
 * Handles HTTP requests for product variant management
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 8.6
 */

/**
 * Create variant options and values for a product
 * @route POST /api/products/:productId/variants
 * @access Private/Seller
 * @requirements 4.1, 4.6
 */
const createVariantOptions = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { options } = req.body;
    const userId = req.user.id;

    // Get seller ID from user
    const seller = await Seller.findOne({ where: { userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Validate product ownership
    const product = await Product.findOne({
      where: { id: productId, seller_id: seller.id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized'
      });
    }

    // Create variant options
    const result = await variantService.createVariantOptions(
      parseInt(productId),
      options,
      seller.id
    );

    res.status(201).json({
      success: true,
      message: 'Variant options created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating variant options:', error);
    
    // Handle specific error messages
    if (error.message.includes('Maximum 3 variant options')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: error.message
      });
    }
    
    if (error.message.includes('unauthorized')) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this product',
        error: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Generate all possible variant combinations
 * @route POST /api/products/:productId/variants/generate
 * @access Private/Seller
 * @requirements 4.2, 4.6
 */
const generateVariantCombinations = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // Get seller ID from user
    const seller = await Seller.findOne({ where: { userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Validate product ownership
    const product = await Product.findOne({
      where: { id: productId, seller_id: seller.id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized'
      });
    }

    // Generate combinations
    const result = await variantService.generateCombinations(
      parseInt(productId),
      seller.id
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Error generating variant combinations:', error);
    
    // Handle specific error messages
    if (error.message.includes('Combination limit exceeded')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: error.message
      });
    }
    
    if (error.message.includes('No variant options found')) {
      return res.status(400).json({
        success: false,
        message: 'No variant options found. Please create variant options first.',
        error: error.message
      });
    }
    
    if (error.message.includes('unauthorized')) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this product',
        error: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Get all variants for a product
 * @route GET /api/products/:productId/variants
 * @access Public (active variants) / Private (all variants for seller)
 * @requirements 4.3, 4.8
 */
const getProductVariants = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { is_active, in_stock } = req.query;

    // Check if user is authenticated and is the product owner
    let isOwner = false;
    if (req.user) {
      const seller = await Seller.findOne({ where: { userId: req.user.id } });
      if (seller) {
        const product = await Product.findOne({
          where: { id: productId, seller_id: seller.id }
        });
        isOwner = !!product;
      }
    }

    // Build filters
    const filters = {};
    
    // Only show active variants to non-owners
    if (!isOwner) {
      filters.is_active = true;
    } else if (is_active !== undefined) {
      filters.is_active = is_active === 'true';
    }
    
    if (in_stock === 'true') {
      filters.in_stock = true;
    }

    // Get variants
    const result = await variantService.getProductVariants(
      parseInt(productId),
      filters
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Error getting product variants:', error);
    next(error);
  }
};

/**
 * Update a specific variant combination
 * @route PUT /api/products/:productId/variants/:variantId
 * @access Private/Seller
 * @requirements 4.4, 4.6
 */
const updateVariantCombination = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Get seller ID from user
    const seller = await Seller.findOne({ where: { userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Validate product ownership
    const product = await Product.findOne({
      where: { id: productId, seller_id: seller.id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized'
      });
    }

    // Update variant
    const result = await variantService.updateVariantCombination(
      parseInt(productId),
      parseInt(variantId),
      updates,
      seller.id
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating variant combination:', error);
    
    // Handle specific error messages
    if (error.message.includes('SKU already exists')) {
      return res.status(409).json({
        success: false,
        message: 'SKU already exists',
        error: error.message
      });
    }
    
    if (error.message.includes('Variant combination not found')) {
      return res.status(404).json({
        success: false,
        message: 'Variant combination not found',
        error: error.message
      });
    }
    
    if (error.message.includes('unauthorized')) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this product',
        error: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Delete a specific variant combination
 * @route DELETE /api/products/:productId/variants/:variantId
 * @access Private/Seller
 * @requirements 4.5, 4.6
 */
const deleteVariantCombination = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const userId = req.user.id;

    // Get seller ID from user
    const seller = await Seller.findOne({ where: { userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Validate product ownership
    const product = await Product.findOne({
      where: { id: productId, seller_id: seller.id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized'
      });
    }

    // Import VariantCombination model
    const { VariantCombination } = require('../models');
    
    // Find and delete variant
    const variant = await VariantCombination.findOne({
      where: { id: variantId, product_id: productId }
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Variant combination not found'
      });
    }

    await variant.destroy();

    res.status(200).json({
      success: true,
      message: 'Variant deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting variant combination:', error);
    
    if (error.message.includes('unauthorized')) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this product',
        error: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Get stock levels for all variants of a product
 * @route GET /api/products/:productId/variants/stock
 * @access Private/Seller
 * @requirements 8.6
 */
const getVariantStock = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // Get seller ID from user
    const seller = await Seller.findOne({ where: { userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Validate product ownership
    const product = await Product.findOne({
      where: { id: productId, seller_id: seller.id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized'
      });
    }

    // Get all variants with stock info
    const result = await variantService.getProductVariants(parseInt(productId), {});
    
    // Format response for stock endpoint
    const variants = result.data.combinations.map(combination => {
      const variantDescription = combination.variant_values
        .map(v => v.value_name)
        .join(' / ');
      
      return {
        id: combination.id,
        sku: combination.sku,
        stock_quantity: combination.stock_quantity,
        low_stock: combination.stock_quantity < 5,
        variant_description: variantDescription,
        is_active: combination.is_active
      };
    });

    res.status(200).json({
      success: true,
      data: {
        variants
      }
    });
  } catch (error) {
    console.error('Error getting variant stock:', error);
    
    if (error.message.includes('unauthorized')) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this product',
        error: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Get variant performance analytics for a product
 * @route GET /api/seller/products/:productId/variant-analytics
 * @access Private/Seller
 * @requirements 15.3, 15.4, 15.5, 15.6
 */
const getVariantAnalytics = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { period = '7d' } = req.query;
    const userId = req.user.id;

    // Get seller ID from user
    const seller = await Seller.findOne({ where: { userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Validate product ownership
    const product = await Product.findOne({
      where: { id: productId, seller_id: seller.id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized'
      });
    }

    // Get analytics data
    const result = await variantAnalyticsService.getVariantAnalytics(
      parseInt(productId),
      seller.id,
      period
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Error getting variant analytics:', error);
    
    if (error.message.includes('unauthorized')) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view analytics for this product',
        error: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Upload image for a variant combination
 * @route POST /api/products/:productId/variants/:variantId/image
 * @access Private/Seller
 * @requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */
const uploadVariantImage = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const userId = req.user.id;

    // Get seller ID from user
    const seller = await Seller.findOne({ where: { userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Validate product ownership
    const product = await Product.findOne({
      where: { id: productId, seller_id: seller.id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized'
      });
    }

    // Check if image was uploaded
    if (!req.variantImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Update variant with image URL
    const updates = {
      image_url: req.variantImageUrl
    };

    const result = await variantService.updateVariantCombination(
      parseInt(productId),
      parseInt(variantId),
      updates,
      seller.id
    );

    res.status(200).json({
      success: true,
      message: 'Variant image uploaded successfully',
      data: {
        image_url: req.variantImageUrl,
        variant: result.data
      }
    });
  } catch (error) {
    console.error('Error uploading variant image:', error);
    
    if (error.message.includes('Variant combination not found')) {
      return res.status(404).json({
        success: false,
        message: 'Variant combination not found',
        error: error.message
      });
    }
    
    if (error.message.includes('unauthorized')) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this product',
        error: error.message
      });
    }
    
    next(error);
  }
};

module.exports = {
  createVariantOptions,
  generateVariantCombinations,
  getProductVariants,
  updateVariantCombination,
  deleteVariantCombination,
  getVariantStock,
  getVariantAnalytics,
  uploadVariantImage
};

/**
 * Migrate an existing product to support variants
 * @route POST /api/products/:productId/variants/migrate
 * @access Private/Seller
 * @requirements 13.1, 13.2, 13.3, 13.7
 */
const migrateProductToVariants = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { options } = req.body;
    const userId = req.user.id;

    // Get seller ID from user
    const seller = await Seller.findOne({ where: { userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Validate product ownership
    const product = await Product.findOne({
      where: { id: productId, seller_id: seller.id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized'
      });
    }

    // Validate options input
    if (!options || !Array.isArray(options) || options.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Variant options are required for migration'
      });
    }

    // Import migration service
    const variantMigrationService = require('../services/variantMigrationService');

    // Perform migration
    const result = await variantMigrationService.migrateProductToVariants(
      parseInt(productId),
      options,
      seller.id
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Error migrating product to variants:', error);
    
    // Handle specific error messages
    if (error.message.includes('already has variants')) {
      return res.status(400).json({
        success: false,
        message: 'Product already has variants',
        error: error.message
      });
    }
    
    if (error.message.includes('Maximum 3 variant options')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: error.message
      });
    }
    
    if (error.message.includes('Combination limit exceeded') || error.message.includes('Cannot generate')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: error.message
      });
    }
    
    if (error.message.includes('not found') || error.message.includes('unauthorized')) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or you do not have permission to modify it',
        error: error.message
      });
    }
    
    next(error);
  }
};

module.exports = {
  createVariantOptions,
  generateVariantCombinations,
  getProductVariants,
  updateVariantCombination,
  deleteVariantCombination,
  getVariantStock,
  getVariantAnalytics,
  uploadVariantImage,
  migrateProductToVariants
};
