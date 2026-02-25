const express = require('express');
const router = express.Router();
const ordersController = require('../../controllers/admin/orders.controller');

router.get('/', ordersController.getAllOrders);
router.get('/:id', ordersController.getOrderById);
router.put('/:id/status', ordersController.updateOrderStatus);

module.exports = router;
