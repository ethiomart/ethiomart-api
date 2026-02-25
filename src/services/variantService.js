const { 
  Product, 
  VariantOption, 
  VariantValue, 
  VariantCombination, 
  VariantCombinationValue,
  sequelize 
} = require('../models');
const { Op } = require('sequelize');

/**
 * VariantService - Core logic for product variant management
 * Handles variant options, values, combinations, and stock management
 */
class VariantService {
  /**
   * Create variant options and values for a product
   * @param {number} productId - The product ID
   * @param {Array} options - Array of option objects with values
   * @param {number} sellerId - The seller ID for authorization
   * @returns {Promise<Object>} Created options with values
   */
  async createVariantOptions(productId, options, sellerId) {
    const transaction = await sequelize.transaction();
    
    try {
      // 1. Validate product exists and belongs to seller
      const product = await Product.findOne({
        where: { id: productId, seller_id: sellerId }
      });
      
      if (!product) {
        throw new Error('Product not found or unauthorized');
      }
      
      // 2. Validate option count <= 3
      if (options.length > 3) {
        throw new Error('Maximum 3 variant options allowed per product');
      }
      
      if (options.length === 0) {
        throw new Error('At least 1 variant option is required');
      }
      
      // 3. Validate option positions are unique
      const positions = options.map(opt => opt.option_position);
      const uniquePositions = new Set(positions);
      if (positions.length !== uniquePositions.size) {
        throw new Error('Option positions must be unique');
      }
      
      const createdOptions = [];
      
      // 4. Create variant_options records
      for (const optionData of options) {
        const { option_name, option_position, values } = optionData;
        
        // Validate option has values
        if (!values || values.length === 0) {
          throw new Error(`Option "${option_name}" must have at least one value`);
        }
        
        // Validate value positions are unique within option
        const valuePositions = values.map(v => v.value_position);
        const uniqueValuePositions = new Set(valuePositions);
        if (valuePositions.length !== uniqueValuePositions.size) {
          throw new Error(`Value positions must be unique within option "${option_name}"`);
        }
        
        // Create the option
        const variantOption = await VariantOption.create({
          product_id: productId,
          option_name,
          option_position
        }, { transaction });
        
        // 5. Create variant_values records
        const createdValues = [];
        for (const valueData of values) {
          const variantValue = await VariantValue.create({
            variant_option_id: variantOption.id,
            value_name: valueData.value_name,
            value_position: valueData.value_position
          }, { transaction });
          
          createdValues.push(variantValue);
        }
        
        createdOptions.push({
          ...variantOption.toJSON(),
          values: createdValues
        });
      }
      
      await transaction.commit();
      
      // 6. Return created options with IDs
      return {
        success: true,
        options: createdOptions
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Generate all possible variant combinations using Cartesian product
   * @param {number} productId - The product ID
   * @param {number} sellerId - The seller ID for authorization
   * @returns {Promise<Object>} Generated combinations
   */
  async generateCombinations(productId, sellerId) {
    const transaction = await sequelize.transaction();
    
    try {
      // 1. Validate product exists and belongs to seller
      const product = await Product.findOne({
        where: { id: productId, seller_id: sellerId }
      });
      
      if (!product) {
        throw new Error('Product not found or unauthorized');
      }
      
      // 2. Fetch all variant options and values for product
      const variantOptions = await VariantOption.findAll({
        where: { product_id: productId },
        include: [{
          model: VariantValue,
          as: 'values',
          attributes: ['id', 'value_name', 'value_position'],
          order: [['value_position', 'ASC']]
        }],
        order: [['option_position', 'ASC']]
      });
      
      if (variantOptions.length === 0) {
        throw new Error('No variant options found for this product');
      }
      
      // 3. Calculate Cartesian product
      const valueArrays = variantOptions.map(option => option.values);
      const combinations = this._cartesianProduct(valueArrays);
      
      // 4. Validate total combinations <= 100
      if (combinations.length > 100) {
        throw new Error(`Combination limit exceeded: ${combinations.length} combinations would be generated (maximum 100 allowed)`);
      }
      
      // 5. Create variant_combinations records
      const createdCombinations = [];
      
      for (let i = 0; i < combinations.length; i++) {
        const valueIds = combinations[i];
        
        // Generate default SKU with timestamp to ensure uniqueness
        const skuParts = [];
        for (let j = 0; j < valueIds.length; j++) {
          const value = valueIds[j];
          const valueName = value.value_name.toUpperCase().replace(/\s+/g, '-');
          skuParts.push(valueName);
        }
        const timestamp = Date.now();
        const defaultSku = `${product.sku || `PROD-${productId}`}-${skuParts.join('-')}-${timestamp}-${i + 1}`;
        
        // Create combination with default values (explicitly set all fields to avoid validation issues)
        const combinationData = {
          product_id: productId,
          sku: defaultSku,
          price: parseFloat(product.price) || 0.01,
          stock_quantity: 0,
          image_url: null,
          is_active: true,
          cart_additions: 0,
          purchases: 0
        };
        
        const combination = await VariantCombination.create(combinationData, { 
          transaction
        });
        
        // 6. Create variant_combination_values junction records
        for (const value of valueIds) {
          await VariantCombinationValue.create({
            variant_combination_id: combination.id,
            variant_value_id: value.id
          }, { transaction });
        }
        
        // Fetch the combination with values for response
        const combinationWithValues = await VariantCombination.findByPk(combination.id, {
          include: [{
            model: VariantValue,
            as: 'variantValues',
            attributes: ['id', 'value_name'],
            through: { attributes: [] }
          }],
          transaction
        });
        
        createdCombinations.push(combinationWithValues);
      }
      
      await transaction.commit();
      
      // 7. Return generated combinations
      return {
        success: true,
        message: `Generated ${createdCombinations.length} variant combinations`,
        data: {
          combinations: createdCombinations.map(c => ({
            id: c.id,
            sku: c.sku,
            price: parseFloat(c.price),
            stock_quantity: c.stock_quantity,
            variant_values: c.variantValues.map(v => v.value_name),
            is_active: c.is_active
          })),
          count: createdCombinations.length
        }
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Helper method to calculate Cartesian product
   * @private
   * @param {Array<Array>} arrays - Arrays of variant values
   * @returns {Array<Array>} Cartesian product result
   */
  _cartesianProduct(arrays) {
    if (arrays.length === 0) return [];
    if (arrays.length === 1) return arrays[0].map(item => [item]);
    
    const result = [];
    const recurse = (current, remaining) => {
      if (remaining.length === 0) {
        result.push(current);
        return;
      }
      
      const [first, ...rest] = remaining;
      for (const item of first) {
        recurse([...current, item], rest);
      }
    };
    
    recurse([], arrays);
    return result;
  }
  
  /**
   * Update a specific variant combination
   * @param {number} productId - The product ID
   * @param {number} variantId - The variant combination ID
   * @param {Object} updates - Fields to update
   * @param {number} sellerId - The seller ID for authorization
   * @returns {Promise<Object>} Updated variant
   */
  async updateVariantCombination(productId, variantId, updates, sellerId) {
    const transaction = await sequelize.transaction();
    
    try {
      // 1. Validate product exists and belongs to seller
      const product = await Product.findOne({
        where: { id: productId, seller_id: sellerId }
      });
      
      if (!product) {
        throw new Error('Product not found or unauthorized');
      }
      
      // 2. Validate variant belongs to product
      const variant = await VariantCombination.findOne({
        where: { id: variantId, product_id: productId }
      });
      
      if (!variant) {
        throw new Error('Variant combination not found for this product');
      }
      
      // 3. Validate SKU uniqueness if SKU is being updated
      if (updates.sku && updates.sku !== variant.sku) {
        const existingSku = await VariantCombination.findOne({
          where: { 
            sku: updates.sku,
            id: { [Op.ne]: variantId }
          }
        });
        
        if (existingSku) {
          throw new Error('SKU already exists');
        }
      }
      
      // 4. Validate price and stock_quantity
      if (updates.price !== undefined) {
        const price = parseFloat(updates.price);
        if (isNaN(price) || price < 0) {
          throw new Error('Price must be a positive number');
        }
        updates.price = price;
      }
      
      if (updates.stock_quantity !== undefined) {
        const stock = parseInt(updates.stock_quantity);
        if (isNaN(stock) || stock < 0) {
          throw new Error('Stock quantity must be a non-negative integer');
        }
        updates.stock_quantity = stock;
      }
      
      // 5. Update variant_combinations record
      await variant.update(updates, { transaction });
      
      await transaction.commit();
      
      // 6. Return updated variant
      const updatedVariant = await this.getVariantById(variantId);
      
      return {
        success: true,
        message: 'Variant updated successfully',
        data: updatedVariant
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Get all variants for a product with eager loading
   * @param {number} productId - The product ID
   * @param {Object} filters - Optional filters (is_active, stock availability)
   * @returns {Promise<Object>} Product variants data
   */
  async getProductVariants(productId, filters = {}) {
    try {
      // 1. Fetch variant options and values
      const variantOptions = await VariantOption.findAll({
        where: { product_id: productId },
        include: [{
          model: VariantValue,
          as: 'values',
          attributes: ['id', 'value_name', 'value_position'],
          order: [['value_position', 'ASC']]
        }],
        order: [['option_position', 'ASC']]
      });
      
      // 2. Build where clause for combinations
      const where = { product_id: productId };
      
      if (filters.is_active !== undefined) {
        where.is_active = filters.is_active;
      }
      
      if (filters.in_stock) {
        where.stock_quantity = { [Op.gt]: 0 };
      }
      
      // 3. Fetch variant combinations with eager loading
      const variantCombinations = await VariantCombination.findAll({
        where,
        include: [{
          model: VariantValue,
          as: 'variantValues',
          attributes: ['id', 'value_name', 'variant_option_id'],
          through: { attributes: [] },
          include: [{
            model: VariantOption,
            as: 'option',
            attributes: ['id', 'option_name', 'option_position']
          }]
        }],
        order: [['id', 'ASC']]
      });
      
      // 4. Calculate price range
      let priceRange = null;
      if (variantCombinations.length > 0) {
        const prices = variantCombinations.map(c => parseFloat(c.price));
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        priceRange = { min: minPrice, max: maxPrice };
      }
      
      // 5. Return structured variant data
      return {
        success: true,
        data: {
          product_id: productId,
          options: variantOptions.map(opt => ({
            id: opt.id,
            option_name: opt.option_name,
            option_position: opt.option_position,
            values: opt.values.map(v => ({
              id: v.id,
              value_name: v.value_name,
              value_position: v.value_position
            }))
          })),
          combinations: variantCombinations.map(c => ({
            id: c.id,
            sku: c.sku,
            price: parseFloat(c.price),
            stock_quantity: c.stock_quantity,
            image_url: c.image_url,
            is_active: c.is_active,
            variant_values: c.variantValues.map(v => ({
              option_name: v.option.option_name,
              value_name: v.value_name
            }))
          })),
          price_range: priceRange
        }
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get a single variant by ID
   * @param {number} variantId - The variant combination ID
   * @returns {Promise<Object>} Variant data
   */
  async getVariantById(variantId) {
    const variant = await VariantCombination.findByPk(variantId, {
      include: [{
        model: VariantValue,
        as: 'variantValues',
        attributes: ['id', 'value_name'],
        through: { attributes: [] },
        include: [{
          model: VariantOption,
          as: 'option',
          attributes: ['option_name']
        }]
      }]
    });
    
    if (!variant) {
      throw new Error('Variant not found');
    }
    
    return {
      id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      price: parseFloat(variant.price),
      stock_quantity: variant.stock_quantity,
      image_url: variant.image_url,
      is_active: variant.is_active,
      variant_values: variant.variantValues.map(v => ({
        option_name: v.option.option_name,
        value_name: v.value_name
      }))
    };
  }
  
  /**
   * Reserve stock for cart addition
   * @param {number} variantId - The variant combination ID
   * @param {number} quantity - Quantity to reserve
   * @returns {Promise<Object>} Success status
   */
  async reserveStock(variantId, quantity) {
    const transaction = await sequelize.transaction();
    
    try {
      const variant = await VariantCombination.findByPk(variantId, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      
      if (!variant) {
        throw new Error('Variant not found');
      }
      
      // Check stock availability
      if (variant.stock_quantity < quantity) {
        throw new Error('Insufficient stock available');
      }
      
      // Decrement stock_quantity and increment cart_additions
      await variant.update({
        stock_quantity: variant.stock_quantity - quantity,
        cart_additions: variant.cart_additions + 1
      }, { transaction });
      
      await transaction.commit();
      
      return {
        success: true,
        message: 'Stock reserved successfully'
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Release stock on cart removal
   * @param {number} variantId - The variant combination ID
   * @param {number} quantity - Quantity to release
   * @returns {Promise<Object>} Success status
   */
  async releaseStock(variantId, quantity) {
    const transaction = await sequelize.transaction();
    
    try {
      const variant = await VariantCombination.findByPk(variantId, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      
      if (!variant) {
        throw new Error('Variant not found');
      }
      
      // Increment stock_quantity
      await variant.update({
        stock_quantity: variant.stock_quantity + quantity
      }, { transaction });
      
      await transaction.commit();
      
      return {
        success: true,
        message: 'Stock released successfully'
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Process purchase (increment purchases counter)
   * @param {number} variantId - The variant combination ID
   * @param {number} quantity - Quantity purchased
   * @returns {Promise<Object>} Success status
   */
  async processPurchase(variantId, quantity) {
    const transaction = await sequelize.transaction();
    
    try {
      const variant = await VariantCombination.findByPk(variantId, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      
      if (!variant) {
        throw new Error('Variant not found');
      }
      
      // Increment purchases counter
      await variant.update({
        purchases: variant.purchases + quantity
      }, { transaction });
      
      await transaction.commit();
      
      return {
        success: true,
        message: 'Purchase processed successfully'
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Get variant image with fallback to product image
   * @param {number} variantId - The variant combination ID
   * @param {number} productId - The product ID
   * @returns {Promise<string|null>} Image URL or null
   * @requirements 9.5, 9.8
   */
  async getVariantImageWithFallback(variantId, productId) {
    try {
      // Get variant
      const variant = await VariantCombination.findByPk(variantId);
      
      if (!variant) {
        throw new Error('Variant not found');
      }
      
      // Return variant image if available
      if (variant.image_url) {
        return variant.image_url;
      }
      
      // Fallback to product's primary image
      const product = await Product.findByPk(productId);
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      // Get first image from product images array
      const productImages = product.images;
      if (productImages && Array.isArray(productImages) && productImages.length > 0) {
        return productImages[0];
      }
      
      // No image available
      return null;
      
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new VariantService();
