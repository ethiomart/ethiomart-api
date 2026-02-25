const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middleware/auth');

// POST /api/reviews - Create review
router.post('/', verifyToken, reviewController.createReview);

// GET /api/reviews/product/:productId - Get product reviews
router.get('/product/:productId', reviewController.getProductReviews);

// PUT /api/reviews/:id - Update review
router.put('/:id', verifyToken, reviewController.updateReview);

// DELETE /api/reviews/:id - Delete review
router.delete('/:id', verifyToken, reviewController.deleteReview);

module.exports = router;
