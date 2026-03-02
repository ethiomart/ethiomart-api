const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const variantController = require('../controllers/variantController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const { cloudinaryUpload } = require('../middleware/cloudinaryUpload');

// POST /api/sellers/profile - Create seller profile
router.post('/profile', verifyToken, requireRole(['seller']), sellerController.createSellerProfile);

// GET /api/sellers/profile - Get own seller profile
router.get('/profile', verifyToken, requireRole(['seller']), sellerController.getSellerProfile);

// PUT /api/sellers/profile - Update seller profile
router.put('/profile', verifyToken, requireRole(['seller']), sellerController.updateSellerProfile);

// POST /api/sellers/logo - Upload seller logo
router.post('/logo', verifyToken, requireRole(['seller']), uploadSingle('logo'), cloudinaryUpload('sellers/logos'), sellerController.uploadLogo);

// GET /api/sellers/dashboard - Get seller dashboard
router.get('/dashboard', verifyToken, requireRole(['seller']), sellerController.getSellerDashboard);

// GET /api/sellers/orders - Get seller orders
router.get('/orders', verifyToken, requireRole(['seller']), sellerController.getSellerOrders);

// GET /api/sellers/earnings - Get seller earnings
router.get('/earnings', verifyToken, requireRole(['seller']), sellerController.getEarnings);

// PUT /api/sellers/orders/:id/status - Update order status (seller)
router.put('/orders/:id/status', verifyToken, requireRole(['seller']), sellerController.updateOrderStatus);

// GET /api/sellers/products/:productId/variant-analytics - Get variant analytics
router.get('/products/:productId/variant-analytics', verifyToken, requireRole(['seller']), variantController.getVariantAnalytics);

module.exports = router;
