const express = require('express');
const router = express.Router();
const productsController = require('../../controllers/admin/products.controller');

router.get('/', productsController.getAllProducts);
router.get('/pending', productsController.getPendingProducts);
router.put('/:id/approve', productsController.approveProduct);
router.put('/:id/reject', productsController.rejectProduct);
router.put('/:id/feature', productsController.featureProduct);
router.delete('/:id', productsController.deleteProduct);

module.exports = router;
