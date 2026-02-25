const express = require('express');
const router = express.Router();
const reportsController = require('../../controllers/admin/reports.controller');

router.get('/sales', reportsController.getSalesReport);
router.get('/products/performance', reportsController.getProductPerformance);
router.get('/sellers/performance', reportsController.getSellerPerformance);
router.post('/export', reportsController.exportReport);

module.exports = router;
