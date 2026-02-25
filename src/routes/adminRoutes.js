const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const authController = require('../controllers/admin/auth.controller');

// --- ADMIN AUTH ROUTES ---
const authRouter = express.Router();
// Login doesn't need verifyToken
authRouter.post('/login', authController.login);
// Other auth routes DO need verification
authRouter.use(verifyToken);
authRouter.post('/logout', authController.logout);
authRouter.get('/profile', authController.getProfile);
router.use('/auth', authRouter);

// Apply admin verification for all other routes
router.use(verifyToken);
router.use(requireRole(['admin']));

// --- MOUNT MODULAR ROUTES ---
router.use('/dashboard', require('./admin/dashboard.routes'));
router.use('/users', require('./admin/users.routes'));
router.use('/products', require('./admin/products.routes'));
router.use('/categories', require('./admin/categories.routes'));
router.use('/brands', require('./admin/brands.routes'));
router.use('/orders', require('./admin/orders.routes'));
router.use('/payments', require('./admin/payments.routes'));
router.use('/cms', require('./admin/cms.routes'));
router.use('/reports', require('./admin/reports.routes'));
router.use('/settings', require('./admin/settings.routes'));

module.exports = router;
