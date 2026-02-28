const Wishlist = require('../models/Wishlist');
const WishlistItem = require('../models/WishlistItem');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Category = require('../models/Category');

/**
 * Get user's wishlist with all products
 * @route GET /api/wishlist
 * @access Private
 */
const getWishlist = async (req, res, next) => {
  try {
    // Validate user exists in request
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: {
          code: 'UNAUTHORIZED'
        }
      });
    }

    const userId = req.user.id;

    // Find or create wishlist for user
    let wishlist = await Wishlist.findOne({
      where: { user_id: userId },
      include: [
        {
          model: WishlistItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'description', 'price', 'quantity', 'images', 'is_published'],
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
              ]
            }
          ]
        }
      ]
    });

    // If no wishlist exists, create one
    if (!wishlist) {
      wishlist = await Wishlist.create({ user_id: userId });
      wishlist.items = [];
    }

    // Format response to match Flutter WishlistModel structure
    const products = (wishlist.items || []).map(item => item.product).filter(product => product !== null);

    res.status(200).json({
      success: true,
      message: 'Wishlist retrieved successfully',
      data: {
        id: wishlist.id,
        user_id: wishlist.user_id,
        products: products,
        created_at: wishlist.created_at,
        updated_at: wishlist.updated_at
      }
    });
  } catch (error) {
    console.error('Error retrieving wishlist:', error);
    
    // Handle database connection errors
    if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeConnectionRefusedError') {
      return res.status(500).json({
        success: false,
        message: 'Database connection error',
        error: {
          code: 'DATABASE_CONNECTION_ERROR'
        }
      });
    }

    // Handle database timeout errors
    if (error.name === 'SequelizeTimeoutError') {
      return res.status(500).json({
        success: false,
        message: 'Database operation timed out',
        error: {
          code: 'DATABASE_TIMEOUT'
        }
      });
    }

    // Handle general database errors
    if (error.name && error.name.startsWith('Sequelize')) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve wishlist',
        error: {
          code: 'DATABASE_ERROR'
        }
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};

/**
 * Add product to wishlist
 * @route POST /api/wishlist
 * @access Private
 */
const addToWishlist = async (req, res, next) => {
  try {
    // Validate user exists in request
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: {
          code: 'UNAUTHORIZED'
        }
      });
    }

    const userId = req.user.id;
    const { productId } = req.body;

    // Validate productId is provided
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
        error: {
          code: 'VALIDATION_ERROR',
          details: 'productId field is required'
        }
      });
    }

    // Validate productId is a positive integer
    const parsedProductId = parseInt(productId);
    if (isNaN(parsedProductId) || parsedProductId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
        error: {
          code: 'VALIDATION_ERROR',
          details: 'productId must be a positive integer'
        }
      });
    }

    // Check if product exists and is active
    const product = await Product.findByPk(parsedProductId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: {
          code: 'PRODUCT_NOT_FOUND'
        }
      });
    }

    if (!product.is_published) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available',
        error: {
          code: 'PRODUCT_INACTIVE'
        }
      });
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ where: { user_id: userId } });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user_id: userId });
    }

    // Check if item already exists in wishlist
    const existingItem = await WishlistItem.findOne({
      where: {
        wishlist_id: wishlist.id,
        product_id: parsedProductId
      }
    });

    if (existingItem) {
      // Product already in wishlist, return existing wishlist
      const updatedWishlist = await Wishlist.findOne({
        where: { user_id: userId },
        include: [
          {
            model: WishlistItem,
            as: 'items',
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'description', 'price', 'quantity', 'images', 'is_published'],
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
                ]
              }
            ]
          }
        ]
      });

      const products = (updatedWishlist.items || []).map(item => item.product).filter(product => product !== null);

      return res.status(200).json({
        success: true,
        message: 'Product already in wishlist',
        data: {
          id: updatedWishlist.id,
          user_id: updatedWishlist.user_id || userId,
          products: products,
          created_at: updatedWishlist.created_at || new Date(),
          updated_at: updatedWishlist.updated_at || new Date()
        }
      });
    }

    // Create new wishlist item
    await WishlistItem.create({
      wishlist_id: wishlist.id,
      product_id: parsedProductId
    });

    // Fetch updated wishlist with all products
    const updatedWishlist = await Wishlist.findOne({
      where: { user_id: userId },
      include: [
        {
          model: WishlistItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'description', 'price', 'quantity', 'images', 'is_published'],
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
              ]
            }
          ]
        }
      ]
    });

    const products = (updatedWishlist.items || []).map(item => item.product).filter(product => product !== null);

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      data: {
        id: updatedWishlist.id,
        user_id: updatedWishlist.user_id || userId,
        products: products,
        created_at: updatedWishlist.created_at || new Date(),
        updated_at: updatedWishlist.updated_at || new Date()
      }
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    
    // Handle database connection errors
    if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeConnectionRefusedError') {
      return res.status(500).json({
        success: false,
        message: 'Database connection error',
        error: {
          code: 'DATABASE_CONNECTION_ERROR'
        }
      });
    }

    // Handle database timeout errors
    if (error.name === 'SequelizeTimeoutError') {
      return res.status(500).json({
        success: false,
        message: 'Database operation timed out',
        error: {
          code: 'DATABASE_TIMEOUT'
        }
      });
    }

    // Handle unique constraint violations (duplicate entries)
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist',
        error: {
          code: 'DUPLICATE_ENTRY'
        }
      });
    }

    // Handle foreign key constraint errors
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product or wishlist reference',
        error: {
          code: 'FOREIGN_KEY_ERROR'
        }
      });
    }

    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: {
          code: 'VALIDATION_ERROR',
          details: error.errors ? error.errors.map(e => e.message).join(', ') : 'Invalid data'
        }
      });
    }

    // Handle general database errors
    if (error.name && error.name.startsWith('Sequelize')) {
      return res.status(500).json({
        success: false,
        message: 'Failed to add product to wishlist',
        error: {
          code: 'DATABASE_ERROR'
        }
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};

/**
 * Remove product from wishlist
 * @route DELETE /api/wishlist/:productId
 * @access Private
 */
const removeFromWishlist = async (req, res, next) => {
  try {
    // Validate user exists in request
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: {
          code: 'UNAUTHORIZED'
        }
      });
    }

    const userId = req.user.id;
    const { productId } = req.params;

    // Validate productId is provided
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
        error: {
          code: 'VALIDATION_ERROR',
          details: 'productId parameter is required'
        }
      });
    }

    // Validate productId is a positive integer
    const parsedProductId = parseInt(productId);
    if (isNaN(parsedProductId) || parsedProductId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
        error: {
          code: 'VALIDATION_ERROR',
          details: 'productId must be a positive integer'
        }
      });
    }

    // Find user's wishlist
    const wishlist = await Wishlist.findOne({ where: { user_id: userId } });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found',
        error: {
          code: 'WISHLIST_NOT_FOUND'
        }
      });
    }

    // Find wishlist item by productId
    const wishlistItem = await WishlistItem.findOne({
      where: {
        wishlist_id: wishlist.id,
        product_id: parsedProductId
      }
    });

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in wishlist',
        error: {
          code: 'PRODUCT_NOT_IN_WISHLIST'
        }
      });
    }

    // Delete wishlist item
    await wishlistItem.destroy();

    // Fetch updated wishlist with all products
    const updatedWishlist = await Wishlist.findOne({
      where: { user_id: userId },
      include: [
        {
          model: WishlistItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'description', 'price', 'quantity', 'images', 'is_published'],
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
              ]
            }
          ]
        }
      ]
    });

    const products = (updatedWishlist.items || []).map(item => item.product).filter(product => product !== null);

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      data: {
        id: updatedWishlist.id,
        user_id: updatedWishlist.user_id || userId,
        products: products,
        created_at: updatedWishlist.created_at || new Date(),
        updated_at: updatedWishlist.updated_at || new Date()
      }
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    
    // Handle database connection errors
    if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeConnectionRefusedError') {
      return res.status(500).json({
        success: false,
        message: 'Database connection error',
        error: {
          code: 'DATABASE_CONNECTION_ERROR'
        }
      });
    }

    // Handle database timeout errors
    if (error.name === 'SequelizeTimeoutError') {
      return res.status(500).json({
        success: false,
        message: 'Database operation timed out',
        error: {
          code: 'DATABASE_TIMEOUT'
        }
      });
    }

    // Handle foreign key constraint errors
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product or wishlist reference',
        error: {
          code: 'FOREIGN_KEY_ERROR'
        }
      });
    }

    // Handle general database errors
    if (error.name && error.name.startsWith('Sequelize')) {
      return res.status(500).json({
        success: false,
        message: 'Failed to remove product from wishlist',
        error: {
          code: 'DATABASE_ERROR'
        }
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist
};

