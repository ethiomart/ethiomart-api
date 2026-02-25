const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const User = require('../models/User');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Update product rating and review count stats
 * @param {number} productId - ID of the product to update
 */
const updateProductStats = async (productId) => {
  try {
    const stats = await Review.findOne({
      where: { productId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('rating')), 'average']
      ],
      raw: true
    });

    const count = parseInt(stats.count) || 0;
    const average = parseFloat(parseFloat(stats.average || 0).toFixed(2));

    await Product.update(
      { 
        rating: average,
        review_count: count 
      },
      { where: { id: productId } }
    );
  } catch (error) {
    console.error('Error updating product stats:', error);
  }
};

/**
 * Create a new review for a product
 * @route POST /api/reviews
 * @access Private
 */
const createReview = async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.user.id;

    // Verify product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has purchased this product
    const hasPurchased = await OrderItem.findOne({
      include: [
        {
          model: Order,
          as: 'order',
          where: {
            userId,
            order_status: { [Op.in]: ['paid', 'processing', 'shipped', 'delivered'] }
          }
        }
      ],
      where: {
        productId
      }
    });

    if (!hasPurchased) {
      return res.status(403).json({
        success: false,
        message: 'You can only review products you have purchased'
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      where: {
        productId,
        userId
      }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product. Use update to modify your review.'
      });
    }

    // Create review
    const review = await Review.create({
      productId,
      userId,
      rating,
      comment
    });

    // Fetch review with user details
    const reviewWithUser = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    // Update product stats (async)
    updateProductStats(productId);

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: {
        review: reviewWithUser
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all reviews for a product with pagination
 * @route GET /api/reviews/product/:productId
 * @access Public
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch reviews with user details
    const { count, rows: reviews } = await Review.findAndCountAll({
      where: {
        productId
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name']
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']]
    });

    // Calculate average rating
    const allReviews = await Review.findAll({
      where: { productId },
      attributes: ['rating']
    });

    const averageRating = allReviews.length > 0
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
      : 0;

    res.status(200).json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: {
        reviews,
        averageRating: parseFloat(averageRating.toFixed(2)),
        totalReviews: count,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update own review
 * @route PUT /api/reviews/:id
 * @access Private
 */
const updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    const review = await Review.findByPk(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Authorization check: only review owner can update
    if (review.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this review'
      });
    }

    // Update review fields
    const updateData = {};
    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment;

    await review.update(updateData);

    // Fetch updated review with user details
    const updatedReview = await Review.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    // Update product stats (async)
    updateProductStats(review.productId);

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: {
        review: updatedReview
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete own review
 * @route DELETE /api/reviews/:id
 * @access Private
 */
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const review = await Review.findByPk(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Authorization check: only review owner can delete
    if (review.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this review'
      });
    }

    const productId = review.productId;
    await review.destroy();

    // Update product stats (async)
    updateProductStats(productId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview
};
