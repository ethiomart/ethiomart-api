const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { verifyToken } = require('../middleware/auth');
const { validateWishlistItem, handleValidationErrors } = require('../middleware/validation');

// GET /api/wishlist - Get user's wishlist
router.get('/', verifyToken, wishlistController.getWishlist);

// POST /api/wishlist - Add product to wishlist
router.post('/', verifyToken, validateWishlistItem, handleValidationErrors, wishlistController.addToWishlist);

// DELETE /api/wishlist/:productId - Remove product from wishlist
router.delete('/:productId', verifyToken, wishlistController.removeFromWishlist);

module.exports = router;
