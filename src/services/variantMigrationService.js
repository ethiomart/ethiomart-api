const { Product, VariantOption, VariantValue, VariantCombination, VariantCombinationValue } = require('../models');
const sequelize = require('../config/database');

/**
 * VariantMigrationService
 * 
 * Service for migrating existing products (without variants) to products with variants.
 * Preserves original product data including price, stock, images, and product_id.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.7
 */
class VariantMigrationService {
  /**
   * Migrate an existing product to support variants
   * 
   * Process:
   * 1. Validate product exists and has no existing variants
   * 2. Create variant options and values based on seller input
   * 3. Generate variant combinations
   * 4. Migrate existing product data (price, stock) to first variant combination
   * 5. Preserve product images as base product images
   * 6. Maintain original product_id
   * 
   * @param {number} productId - ID of the product to migrate
   * @param {Array} options - Variant options configuration
   * @param {number} sellerId - ID of the seller (for authorization)
   * @returns {Promise<Object>} Migration result with product and variant data
   * 
   * @requirements 13.1, 13.2, 13.3, 13.7
   */
  async migrateProductToVariants(productId, options, sellerId) {
    const transaction = await sequelize.transaction();

    try {
      // 1. Validate product exists and belongs to seller
      const product = await Product.findOne({
        where: { id: productId, seller_id: sellerId },
        transaction
      });

      if (!product) {
        throw new Error('Product not found or you do not have permission to modify it');
      }

      // 2. Check if product already has variants
      const existingVariants = await VariantOption.findAll({
        where: { product_id: productId },
        transaction
      });

      if (existingVariants.length > 0) {
        throw new Error('Product already has variants. Cannot migrate a product that already has variants.');
      }

      // 3. Store original product data for migration
      const originalPrice = parseFloat(product.price);
      const originalStock = parseInt(product.quantity);
      const originalImages = product.images || [];

      // 4. Validate options input
      if (!Array.isArray(options) || options.length === 0) {
        throw new Error('At least one variant option is required');
      }

      if (options.length > 3) {
        throw new Error('Maximum 3 variant options allowed');
      }

      // 5. Create variant options and values
      const createdOptions = [];
      
      for (const optionData of options) {
        // Validate option data
        if (!optionData.option_name || optionData.option_name.trim().length === 0) {
          throw new Error('Option name is required');
        }

        if (!Array.isArray(optionData.values) || optionData.values.length === 0) {
          throw new Error(`Option "${optionData.option_name}" must have at least one value`);
        }

        // Create variant option
        const variantOption = await VariantOption.create({
          product_id: productId,
          option_name: optionData.option_name.trim(),
          option_position: optionData.option_position || (createdOptions.length + 1)
        }, { transaction });

        // Create variant values
        const createdValues = [];
        for (const valueData of optionData.values) {
          if (!valueData.value_name || valueData.value_name.trim().length === 0) {
            throw new Error(`Value name is required for option "${optionData.option_name}"`);
          }

          const variantValue = await VariantValue.create({
            variant_option_id: variantOption.id,
            value_name: valueData.value_name.trim(),
            value_position: valueData.value_position || (createdValues.length + 1)
          }, { transaction });

          createdValues.push(variantValue);
        }

        createdOptions.push({
          ...variantOption.toJSON(),
          values: createdValues
        });
      }

      // 6. Generate variant combinations using Cartesian product
      const combinations = this._generateCombinations(createdOptions);

      // Validate combination count
      if (combinations.length > 100) {
        throw new Error(`Cannot generate ${combinations.length} combinations. Maximum allowed is 100.`);
      }

      // 7. Create variant combinations
      const createdCombinations = [];
      
      for (let i = 0; i < combinations.length; i++) {
        const combination = combinations[i];
        
        // For the first combination, use original product data
        // For subsequent combinations, use default values
        const isFirstCombination = i === 0;
        
        // Generate SKU
        const skuSuffix = combination.map(v => v.value_name.toUpperCase().replace(/\s+/g, '-')).join('-');
        const sku = `${product.sku || `PROD-${productId}`}-${skuSuffix}`;

        // Create variant combination
        const variantCombination = await VariantCombination.create({
          product_id: productId,
          sku: sku,
          price: isFirstCombination ? originalPrice : originalPrice, // All variants start with same price
          stock_quantity: isFirstCombination ? originalStock : 0, // Only first variant gets original stock
          image_url: null, // Will use product base images as fallback
          is_active: true
        }, { transaction });

        // Create junction table entries linking combination to values
        for (const value of combination) {
          await VariantCombinationValue.create({
            variant_combination_id: variantCombination.id,
            variant_value_id: value.id
          }, { transaction });
        }

        createdCombinations.push({
          ...variantCombination.toJSON(),
          variant_values: combination.map(v => ({
            option_name: v.option_name,
            value_name: v.value_name
          }))
        });
      }

      // 8. Update product to indicate it now has variants
      // Note: We preserve the original product_id and images
      // The product's price and quantity fields are now informational only
      // Actual inventory is managed at the variant level
      
      await transaction.commit();

      return {
        success: true,
        message: `Successfully migrated product to variants. Created ${createdCombinations.length} variant combinations.`,
        data: {
          product_id: productId,
          original_price: originalPrice,
          original_stock: originalStock,
          images_preserved: originalImages.length,
          options: createdOptions,
          combinations: createdCombinations,
          migration_summary: {
            total_combinations: createdCombinations.length,
            first_combination_stock: originalStock,
            other_combinations_stock: 0,
            all_combinations_price: originalPrice
          }
        }
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Generate all possible variant combinations using Cartesian product
   * 
   * @param {Array} options - Array of variant options with their values
   * @returns {Array} Array of combinations, each containing one value from each option
   * @private
   */
  _generateCombinations(options) {
    if (options.length === 0) {
      return [];
    }

    // Extract value arrays with metadata
    const valueArrays = options.map(option => 
      option.values.map(value => ({
        id: value.id,
        value_name: value.value_name,
        option_name: option.option_name,
        option_id: option.id
      }))
    );

    // Calculate Cartesian product
    return this._cartesianProduct(valueArrays);
  }

  /**
   * Calculate Cartesian product of arrays
   * 
   * @param {Array} arrays - Array of arrays to calculate product from
   * @returns {Array} Cartesian product result
   * @private
   */
  _cartesianProduct(arrays) {
    if (arrays.length === 0) {
      return [];
    }

    if (arrays.length === 1) {
      return arrays[0].map(item => [item]);
    }

    const result = [];
    const [first, ...rest] = arrays;
    const restProduct = this._cartesianProduct(rest);

    for (const item of first) {
      for (const combination of restProduct) {
        result.push([item, ...combination]);
      }
    }

    return result;
  }

  /**
   * Validate if a product can be migrated to variants
   * 
   * @param {number} productId - ID of the product to check
   * @param {number} sellerId - ID of the seller (for authorization)
   * @returns {Promise<Object>} Validation result
   */
  async validateMigrationEligibility(productId, sellerId) {
    try {
      // Check if product exists and belongs to seller
      const product = await Product.findOne({
        where: { id: productId, seller_id: sellerId }
      });

      if (!product) {
        return {
          eligible: false,
          reason: 'Product not found or you do not have permission to modify it'
        };
      }

      // Check if product already has variants
      const existingVariants = await VariantOption.findAll({
        where: { product_id: productId }
      });

      if (existingVariants.length > 0) {
        return {
          eligible: false,
          reason: 'Product already has variants'
        };
      }

      return {
        eligible: true,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: product.quantity,
          images: product.images
        }
      };

    } catch (error) {
      throw error;
    }
  }
}

module.exports = new VariantMigrationService();
