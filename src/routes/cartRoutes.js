const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken } = require('../middleware/auth');
const { validateAddToCart, validateUpdateCartItem, handleValidationErrors } = require('../middleware/validation');

// GET /api/cart - Get user's cart
router.get('/', verifyToken, cartController.getCart);

// POST /api/cart/items - Add item to cart
router.post('/items', verifyToken, validateAddToCart, handleValidationErrors, cartController.addToCart);

// PUT /api/cart/items/:id - Update cart item
router.put('/items/:id', verifyToken, validateUpdateCartItem, handleValidationErrors, cartController.updateCartItem);

// DELETE /api/cart/items/:id - Remove cart item
router.delete('/items/:id', verifyToken, cartController.removeFromCart);

// DELETE /api/cart - Clear cart
router.delete('/', verifyToken, cartController.clearCart);

module.exports = router;
