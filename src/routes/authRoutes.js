const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { validateRegistration, validateLogin, validateSellerRegistration, handleValidationErrors } = require('../middleware/validation');
const { upload } = require('../middleware/upload');
const { cloudinaryUpload } = require('../middleware/cloudinaryUpload');

// POST /api/auth/register - Register new user
router.post('/register', validateRegistration, handleValidationErrors, authController.register);

// POST /api/auth/register-seller - Register seller account (with document uploads)
router.post('/register-seller', 
  verifyToken, 
  upload.fields([
    { name: 'businessLicense', maxCount: 1 },
    { name: 'verificationDoc', maxCount: 1 }
  ]),
  cloudinaryUpload('sellers/docs'),
  validateSellerRegistration, 
  handleValidationErrors, 
  authController.registerSeller
);

// POST /api/auth/login - Login user
router.post('/login', validateLogin, handleValidationErrors, authController.login);

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', authController.refreshToken);

// POST /api/auth/logout - Logout user
router.post('/logout', verifyToken, authController.logout);

// GET /api/auth/profile - Get current user profile
router.get('/profile', verifyToken, authController.getProfile);

// POST /api/auth/fcm-token - Save FCM token for push notifications
router.post('/fcm-token', verifyToken, authController.saveFcmToken);

module.exports = router;
