const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/admin/dashboard.controller');

router.get('/', dashboardController.getDashboardStats);
router.get('/stats', dashboardController.getDashboardStats);
router.get('/overview', dashboardController.getDashboardOverview);

module.exports = router;
