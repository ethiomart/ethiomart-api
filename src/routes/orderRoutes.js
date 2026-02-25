const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateOrder, handleValidationErrors } = require('../middleware/validation');

// POST /api/orders - Create order
router.post('/', verifyToken, validateOrder, handleValidationErrors, orderController.createOrder);

// GET /api/orders - Get user's orders
router.get('/', verifyToken, orderController.getOrders);

// GET /api/orders/customer/orders - Get customer orders (specific route for Flutter app)
router.get('/customer/orders', verifyToken, orderController.getCustomerOrders);

// GET /api/orders/:id - Get order details
router.get('/:id', verifyToken, orderController.getOrderById);

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', verifyToken, requireRole(['seller', 'admin']), orderController.updateOrderStatus);

// POST /api/orders/:id/cancel - Cancel order
router.post('/:id/cancel', verifyToken, orderController.cancelOrder);

module.exports = router;
