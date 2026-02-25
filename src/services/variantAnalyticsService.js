const { 
  Product, 
  VariantCombination, 
  VariantValue,
  VariantOption,
  sequelize 
} = require('../models');
const { Op } = require('sequelize');

/**
 * VariantAnalyticsService - Analytics and performance tracking for product variants
 * Handles variant performance metrics, conversion rates, and top performer identification
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7
 */
class VariantAnalyticsService {
  /**
   * Get variant performance analytics for a product
   * @param {number} productId - The product ID
   * @param {number} sellerId - The seller ID for authorization
   * @param {string} period - Time period for analytics (default: '7d')
   * @returns {Promise<Object>} Analytics data with conversion rates and rankings
   * @requirements 15.3, 15.4, 15.5, 15.6
   */
  async getVariantAnalytics(productId, sellerId, period = '7d') {
    try {
      // 1. Validate product exists and belongs to seller
      const product = await Product.findOne({
        where: { id: productId, seller_id: sellerId }
      });
      
      if (!product) {
        throw new Error('Product not found or unauthorized');
      }
      
      // 2. Fetch variant combinations with analytics data
      const variants = await VariantCombination.findAll({
        where: { product_id: productId },
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
        }],
        order: [['purchases', 'DESC']]
      });
      
      if (variants.length === 0) {
        return {
          success: true,
          data: {
            variants: [],
            top_performers: [],
            period: period
          }
        };
      }
      
      // 3. Calculate conversion rates and rank variants
      const variantsWithAnalytics = variants.map(variant => {
        const cartAdditions = variant.cart_additions || 0;
        const purchases = variant.purchases || 0;
        
        // Calculate conversion rate (purchases / cart_additions)
        const conversionRate = cartAdditions > 0 
          ? parseFloat((purchases / cartAdditions).toFixed(2))
          : 0;
        
        // Build variant description
        const variantDescription = variant.variantValues
          .map(v => v.value_name)
          .join(' / ');
        
        return {
          id: variant.id,
          sku: variant.sku,
          variant_description: variantDescription,
          cart_additions: cartAdditions,
          purchases: purchases,
          conversion_rate: conversionRate,
          stock_quantity: variant.stock_quantity,
          price: parseFloat(variant.price),
          is_active: variant.is_active
        };
      });
      
      // 4. Rank variants by performance (purchases as primary metric)
      const rankedVariants = variantsWithAnalytics
        .sort((a, b) => {
          // Primary: purchases (descending)
          if (b.purchases !== a.purchases) {
            return b.purchases - a.purchases;
          }
          // Secondary: conversion rate (descending)
          if (b.conversion_rate !== a.conversion_rate) {
            return b.conversion_rate - a.conversion_rate;
          }
          // Tertiary: cart additions (descending)
          return b.cart_additions - a.cart_additions;
        })
        .map((variant, index) => ({
          ...variant,
          rank: index + 1
        }));
      
      // 5. Identify top 3 performers
      const topPerformers = rankedVariants
        .slice(0, 3)
        .map(v => v.id);
      
      // 6. Return analytics data
      return {
        success: true,
        data: {
          variants: rankedVariants,
          top_performers: topPerformers,
          period: period,
          summary: {
            total_variants: rankedVariants.length,
            total_cart_additions: rankedVariants.reduce((sum, v) => sum + v.cart_additions, 0),
            total_purchases: rankedVariants.reduce((sum, v) => sum + v.purchases, 0),
            average_conversion_rate: rankedVariants.length > 0
              ? parseFloat((rankedVariants.reduce((sum, v) => sum + v.conversion_rate, 0) / rankedVariants.length).toFixed(2))
              : 0
          }
        }
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Aggregate weekly analytics data (scheduled job)
   * This method should be called by a cron job to aggregate and archive analytics data
   * @returns {Promise<Object>} Aggregation results
   * @requirements 15.7
   */
  async aggregateWeeklyAnalytics() {
    const transaction = await sequelize.transaction();
    
    try {
      // 1. Get all variant combinations with analytics data
      const variants = await VariantCombination.findAll({
        attributes: [
          'id',
          'product_id',
          'sku',
          'cart_additions',
          'purchases'
        ],
        where: {
          [Op.or]: [
            { cart_additions: { [Op.gt]: 0 } },
            { purchases: { [Op.gt]: 0 } }
          ]
        },
        transaction
      });
      
      // 2. Store aggregated data (in a real implementation, this would go to an analytics table)
      // For now, we'll just log the aggregation
      const aggregationData = {
        timestamp: new Date(),
        total_variants_tracked: variants.length,
        total_cart_additions: variants.reduce((sum, v) => sum + v.cart_additions, 0),
        total_purchases: variants.reduce((sum, v) => sum + v.purchases, 0),
        variants_by_product: {}
      };
      
      // Group by product
      variants.forEach(variant => {
        if (!aggregationData.variants_by_product[variant.product_id]) {
          aggregationData.variants_by_product[variant.product_id] = {
            cart_additions: 0,
            purchases: 0,
            variant_count: 0
          };
        }
        
        aggregationData.variants_by_product[variant.product_id].cart_additions += variant.cart_additions;
        aggregationData.variants_by_product[variant.product_id].purchases += variant.purchases;
        aggregationData.variants_by_product[variant.product_id].variant_count += 1;
      });
      
      // 3. Reset counters for new period (optional - depends on business requirements)
      // Uncomment the following lines if you want to reset counters after aggregation
      /*
      await VariantCombination.update(
        {
          cart_additions: 0,
          purchases: 0
        },
        {
          where: {
            [Op.or]: [
              { cart_additions: { [Op.gt]: 0 } },
              { purchases: { [Op.gt]: 0 } }
            ]
          },
          transaction
        }
      );
      */
      
      await transaction.commit();
      
      console.log('Weekly analytics aggregation completed:', aggregationData);
      
      return {
        success: true,
        message: 'Weekly analytics aggregated successfully',
        data: aggregationData
      };
      
    } catch (error) {
      await transaction.rollback();
      console.error('Error aggregating weekly analytics:', error);
      throw error;
    }
  }
  
  /**
   * Increment cart additions counter for a variant
   * Called when a variant is added to cart
   * @param {number} variantId - The variant combination ID
   * @returns {Promise<Object>} Success status
   * @requirements 15.1
   */
  async incrementCartAdditions(variantId) {
    try {
      const variant = await VariantCombination.findByPk(variantId);
      
      if (!variant) {
        throw new Error('Variant not found');
      }
      
      await variant.increment('cart_additions', { by: 1 });
      
      return {
        success: true,
        message: 'Cart additions counter incremented'
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Increment purchases counter for a variant
   * Called when a variant is purchased
   * @param {number} variantId - The variant combination ID
   * @param {number} quantity - Quantity purchased (default: 1)
   * @returns {Promise<Object>} Success status
   * @requirements 15.2
   */
  async incrementPurchases(variantId, quantity = 1) {
    try {
      const variant = await VariantCombination.findByPk(variantId);
      
      if (!variant) {
        throw new Error('Variant not found');
      }
      
      await variant.increment('purchases', { by: quantity });
      
      return {
        success: true,
        message: 'Purchases counter incremented'
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get top performing variants across all products for a seller
   * @param {number} sellerId - The seller ID
   * @param {number} limit - Number of top variants to return (default: 10)
   * @returns {Promise<Object>} Top performing variants
   * @requirements 15.5
   */
  async getTopPerformingVariants(sellerId, limit = 10) {
    try {
      // Get all products for seller
      const products = await Product.findAll({
        where: { seller_id: sellerId },
        attributes: ['id', 'title']
      });
      
      if (products.length === 0) {
        return {
          success: true,
          data: {
            variants: []
          }
        };
      }
      
      const productIds = products.map(p => p.id);
      
      // Get top variants across all products
      const topVariants = await VariantCombination.findAll({
        where: { 
          product_id: { [Op.in]: productIds },
          is_active: true
        },
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'title']
          },
          {
            model: VariantValue,
            as: 'variantValues',
            attributes: ['value_name'],
            through: { attributes: [] }
          }
        ],
        order: [
          ['purchases', 'DESC'],
          ['cart_additions', 'DESC']
        ],
        limit: limit
      });
      
      // Format response
      const formattedVariants = topVariants.map((variant, index) => {
        const cartAdditions = variant.cart_additions || 0;
        const purchases = variant.purchases || 0;
        const conversionRate = cartAdditions > 0 
          ? parseFloat((purchases / cartAdditions).toFixed(2))
          : 0;
        
        const variantDescription = variant.variantValues
          .map(v => v.value_name)
          .join(' / ');
        
        return {
          rank: index + 1,
          product_id: variant.product_id,
          product_title: variant.product.title,
          variant_id: variant.id,
          sku: variant.sku,
          variant_description: variantDescription,
          cart_additions: cartAdditions,
          purchases: purchases,
          conversion_rate: conversionRate,
          stock_quantity: variant.stock_quantity,
          price: parseFloat(variant.price)
        };
      });
      
      return {
        success: true,
        data: {
          variants: formattedVariants,
          total_count: formattedVariants.length
        }
      };
      
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new VariantAnalyticsService();
