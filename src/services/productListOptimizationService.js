const { 
  Product, 
  VariantCombination,
  Seller,
  Category,
  User,
  sequelize 
} = require('../models');
const { Op } = require('sequelize');

/**
 * ProductListOptimizationService
 * Handles optimized product list queries with variant data
 * Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.7
 */
class ProductListOptimizationService {
  /**
   * Get products with variant count and price range
   * Uses optimized queries with eager loading and pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Products with pagination
   */
  async getProductsWithVariantData(options = {}) {
    const {
      page = 1,
      limit = 20,
      categoryId,
      minPrice,
      maxPrice,
      sellerId,
      isPublished = true,
      includeVariants = true
    } = options;

    try {
      // Build where clause for products
      const where = {};
      
      if (isPublished !== undefined) {
        where.is_published = isPublished;
      }
      
      if (categoryId) {
        where.category_id = categoryId;
      }
      
      if (sellerId) {
        where.seller_id = sellerId;
      }
      
      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Fetch products with basic associations (optimized - no full variant data)
      const { count, rows: products } = await Product.findAndCountAll({
        where,
        attributes: [
          'id',
          'seller_id',
          'category_id',
          'name',
          'slug',
          'sku',
          'description',
          'short_description',
          'price',
          'discount_price',
          'quantity',
          'is_featured',
          'is_published',
          'approval_status',
          'views',
          'sold_count',
          'rating',
          'review_count',
          'images',
          'created_at',
          'updated_at'
        ],
        include: [
          {
            model: Seller,
            as: 'seller',
            attributes: ['id', 'store_name', 'store_description']
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'description']
          }
        ],
        limit: parseInt(limit),
        offset,
        order: [['created_at', 'DESC']],
        distinct: true
      });
      
      // If variants should be included, fetch variant data separately for efficiency
      let productsWithVariantData = products;
      
      if (includeVariants && products.length > 0) {
        const productIds = products.map(p => p.id);
        
        // Fetch variant counts and price ranges in a single optimized query
        const variantData = await this._getVariantDataForProducts(productIds);
        
        // Merge variant data with products
        productsWithVariantData = products.map(product => {
          const productJson = product.toJSON();
          const variantInfo = variantData[product.id];
          
          if (variantInfo) {
            productJson.variant_count = variantInfo.count;
            productJson.price_range = variantInfo.price_range;
            productJson.has_variants = variantInfo.count > 0;
          } else {
            productJson.variant_count = 0;
            productJson.price_range = null;
            productJson.has_variants = false;
          }
          
          return productJson;
        });
      }
      
      // Apply price filtering if needed (after variant data is loaded)
      let filteredProducts = productsWithVariantData;
      let filteredCount = count;
      
      if ((minPrice || maxPrice) && includeVariants) {
        filteredProducts = productsWithVariantData.filter(product => {
          // Check base price or variant price range
          const priceToCheck = product.price_range 
            ? product.price_range.min 
            : parseFloat(product.price);
          
          const maxPriceToCheck = product.price_range 
            ? product.price_range.max 
            : parseFloat(product.price);
          
          let matchesMin = true;
          let matchesMax = true;
          
          if (minPrice) {
            matchesMin = maxPriceToCheck >= parseFloat(minPrice);
          }
          
          if (maxPrice) {
            matchesMax = priceToCheck <= parseFloat(maxPrice);
          }
          
          return matchesMin && matchesMax;
        });
        
        filteredCount = filteredProducts.length;
      }
      
      return {
        success: true,
        data: {
          products: filteredProducts,
          pagination: {
            current_page: parseInt(page),
            total_pages: Math.ceil(filteredCount / parseInt(limit)),
            total_items: filteredCount,
            items_per_page: parseInt(limit)
          }
        }
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get variant data (count and price range) for multiple products
   * Uses optimized aggregation query
   * @private
   * @param {Array<number>} productIds - Array of product IDs
   * @returns {Promise<Object>} Variant data indexed by product ID
   */
  async _getVariantDataForProducts(productIds) {
    try {
      // Use raw query for optimal performance
      const results = await sequelize.query(`
        SELECT 
          product_id,
          COUNT(*) as variant_count,
          MIN(price) as min_price,
          MAX(price) as max_price
        FROM variant_combinations
        WHERE product_id IN (:productIds)
          AND is_active = true
        GROUP BY product_id
      `, {
        replacements: { productIds },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Index results by product_id
      const variantDataMap = {};
      
      for (const result of results) {
        variantDataMap[result.product_id] = {
          count: parseInt(result.variant_count),
          price_range: {
            min: parseFloat(result.min_price),
            max: parseFloat(result.max_price)
          }
        };
      }
      
      return variantDataMap;
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Search products with variant filters
   * Optimized search with variant attribute filtering
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchProductsWithVariants(options = {}) {
    const {
      keyword = '',
      page = 1,
      limit = 20,
      categoryId,
      minPrice,
      maxPrice,
      variantFilters = {} // e.g., { color: 'Red', size: 'Large' }
    } = options;
    
    try {
      // Build where clause for products
      const where = {
        is_published: true
      };
      
      if (keyword.trim()) {
        where[Op.or] = [
          { name: { [Op.like]: `%${keyword}%` } },
          { description: { [Op.like]: `%${keyword}%` } },
          { short_description: { [Op.like]: `%${keyword}%` } }
        ];
      }
      
      if (categoryId) {
        where.category_id = categoryId;
      }
      
      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // If variant filters are provided, we need to filter products by variants
      let productIds = null;
      
      if (Object.keys(variantFilters).length > 0) {
        productIds = await this._getProductIdsWithVariantFilters(variantFilters);
        
        if (productIds.length === 0) {
          // No products match the variant filters
          return {
            success: true,
            data: {
              products: [],
              search_term: keyword,
              filters_applied: variantFilters,
              pagination: {
                current_page: parseInt(page),
                total_pages: 0,
                total_items: 0,
                items_per_page: parseInt(limit)
              }
            }
          };
        }
        
        where.id = { [Op.in]: productIds };
      }
      
      // Fetch products
      const { count, rows: products } = await Product.findAndCountAll({
        where,
        attributes: [
          'id',
          'seller_id',
          'category_id',
          'name',
          'slug',
          'sku',
          'description',
          'short_description',
          'price',
          'discount_price',
          'quantity',
          'is_featured',
          'is_published',
          'views',
          'sold_count',
          'rating',
          'review_count',
          'images',
          'created_at'
        ],
        include: [
          {
            model: Seller,
            as: 'seller',
            attributes: ['id', 'store_name']
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          }
        ],
        limit: parseInt(limit),
        offset,
        order: [['created_at', 'DESC']],
        distinct: true
      });
      
      // Get variant data for products
      let productsWithVariantData = products;
      
      if (products.length > 0) {
        const productIdList = products.map(p => p.id);
        const variantData = await this._getVariantDataForProducts(productIdList);
        
        // Get matched variants if filters were applied
        const matchedVariants = Object.keys(variantFilters).length > 0
          ? await this._getMatchedVariants(productIdList, variantFilters)
          : {};
        
        productsWithVariantData = products.map(product => {
          const productJson = product.toJSON();
          const variantInfo = variantData[product.id];
          
          if (variantInfo) {
            productJson.variant_count = variantInfo.count;
            productJson.price_range = variantInfo.price_range;
            productJson.has_variants = true;
          } else {
            productJson.variant_count = 0;
            productJson.price_range = null;
            productJson.has_variants = false;
          }
          
          // Add matched variants if filters were applied
          if (matchedVariants[product.id]) {
            productJson.matched_variants = matchedVariants[product.id];
          }
          
          return productJson;
        });
      }
      
      // Apply price filtering
      let filteredProducts = productsWithVariantData;
      let filteredCount = count;
      
      if (minPrice || maxPrice) {
        filteredProducts = productsWithVariantData.filter(product => {
          const priceToCheck = product.price_range 
            ? product.price_range.min 
            : parseFloat(product.price);
          
          const maxPriceToCheck = product.price_range 
            ? product.price_range.max 
            : parseFloat(product.price);
          
          let matchesMin = true;
          let matchesMax = true;
          
          if (minPrice) {
            matchesMin = maxPriceToCheck >= parseFloat(minPrice);
          }
          
          if (maxPrice) {
            matchesMax = priceToCheck <= parseFloat(maxPrice);
          }
          
          return matchesMin && matchesMax;
        });
        
        filteredCount = filteredProducts.length;
      }
      
      return {
        success: true,
        data: {
          products: filteredProducts,
          search_term: keyword,
          filters_applied: variantFilters,
          pagination: {
            current_page: parseInt(page),
            total_pages: Math.ceil(filteredCount / parseInt(limit)),
            total_items: filteredCount,
            items_per_page: parseInt(limit)
          }
        }
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get product IDs that have variants matching the filters
   * @private
   * @param {Object} variantFilters - Variant attribute filters
   * @returns {Promise<Array<number>>} Product IDs
   */
  async _getProductIdsWithVariantFilters(variantFilters) {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd need to join through variant_values and variant_options
      // For now, we'll return all product IDs (to be implemented in task 8)
      
      // TODO: Implement proper variant filtering in task 8
      return [];
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get matched variants for products based on filters
   * @private
   * @param {Array<number>} productIds - Product IDs
   * @param {Object} variantFilters - Variant attribute filters
   * @returns {Promise<Object>} Matched variants indexed by product ID
   */
  async _getMatchedVariants(productIds, variantFilters) {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd fetch the actual matching variants
      // For now, we'll return empty object (to be implemented in task 8)
      
      // TODO: Implement matched variant fetching in task 8
      return {};
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get product by ID with optimized variant data loading
   * Uses eager loading for performance
   * @param {number} productId - Product ID
   * @returns {Promise<Object>} Product with variant data
   */
  async getProductByIdOptimized(productId) {
    try {
      // Fetch product with basic associations
      const product = await Product.findByPk(productId, {
        include: [
          {
            model: Seller,
            as: 'seller',
            attributes: ['id', 'store_name', 'store_description', 'business_phone'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'email', 'first_name', 'last_name']
              }
            ]
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'description', 'parent_id']
          }
        ]
      });
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      const productJson = product.toJSON();
      
      // Get variant data
      const variantData = await this._getVariantDataForProducts([productId]);
      const variantInfo = variantData[productId];
      
      if (variantInfo) {
        productJson.variant_count = variantInfo.count;
        productJson.price_range = variantInfo.price_range;
        productJson.has_variants = true;
      } else {
        productJson.variant_count = 0;
        productJson.price_range = null;
        productJson.has_variants = false;
      }
      
      return {
        success: true,
        data: {
          product: productJson
        }
      };
      
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new ProductListOptimizationService();
