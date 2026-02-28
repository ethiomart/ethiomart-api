const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { 
  validatePaymentInitialization, 
  validateWebhookPayload, 
  handleValidationErrors,
  enforceHTTPS,
  validateHTTPSUrls
} = require('../middleware/validation');

// Rate limiter for payment initialization (stricter than general API)
// Requirement 11: Security and Validation - Rate limiting on payment endpoints
const paymentInitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each user to 10 payment initializations per 15 minutes
  message: {
    success: false,
    message: 'Too many payment initialization attempts. Please try again later.',
    error: 'Rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip keyGenerator to use default behavior (handles IPv6 properly)
  skip: (req) => !!req.user?.id, // Skip rate limiting for authenticated users (use separate logic)
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many payment initialization attempts. Please try again later.',
      error: 'Rate limit exceeded'
    });
  }
});

// Rate limiter for webhook endpoint (prevent abuse)
// Requirement 11: Security and Validation - Rate limiting on webhook endpoint
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow up to 100 webhook calls per minute (Chapa may send multiple)
  message: {
    success: false,
    message: 'Too many webhook requests',
    error: 'Rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default keyGenerator (handles IPv6 properly)
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many webhook requests',
      error: 'Rate limit exceeded'
    });
  }
});

// Rate limiter for payment verification (moderate)
const verifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Allow 30 verification requests per 5 minutes
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.',
    error: 'Rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default keyGenerator (handles IPv6 properly)
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many verification attempts. Please try again later.',
      error: 'Rate limit exceeded'
    });
  }
});

// POST /api/payments/initiate - Initialize payment (requires authentication)
// Property 55: Secret Key Non-Exposure - Rate limited to prevent abuse
// Property 51: HTTPS-only communication
router.post(
  '/initiate', 
  enforceHTTPS, // Enforce HTTPS in production
  verifyToken,
  paymentInitLimiter, // Apply strict rate limiting
  validateHTTPSUrls, // Validate callback/return URLs use HTTPS
  validatePaymentInitialization, 
  handleValidationErrors, 
  paymentController.initiatePayment
);

// GET /api/payments/verify/:reference - Verify payment (requires authentication)
// Property 17, 18, 19: Status, Amount, Currency Validation
router.get(
  '/verify/:reference',
  enforceHTTPS, // Enforce HTTPS in production
  verifyToken,
  verifyLimiter, // Apply moderate rate limiting
  paymentController.verifyPayment
);

// POST /api/payments/webhook - Handle Chapa webhook (NO authentication - public endpoint)
// Property 48: Callback IP Validation, Property 50: Idempotent Order Confirmation
// Note: Webhook endpoint should accept HTTP in development but HTTPS in production
router.post(
  '/webhook',
  webhookLimiter, // Apply webhook-specific rate limiting
  validateWebhookPayload, 
  handleValidationErrors, 
  paymentController.handleWebhook
);

// POST /api/payments/callback - Handle Chapa callback with async verification (Task 7)
// Task 7.1-7.10: Professional callback handler with immediate response and async verification
// Note: This is the new implementation that responds immediately and verifies asynchronously
router.post(
  '/callback',
  webhookLimiter, // Apply webhook-specific rate limiting
  paymentController.handleCallback
);

// GET /api/payments/return - Handle Chapa return URL (Task 9)
// Task 9.1-9.6: Return URL handler that signals Flutter WebView to close
// This endpoint returns an HTML page that the Flutter WebView displays after payment
// The HTML includes JavaScript that signals the WebView to close and return to the app
// Note: This is a public endpoint (no authentication) as it's accessed by Chapa redirect
router.get(
  '/return',
  paymentController.handleReturn
);

// GET /api/payments/status/:tx_ref - Get payment status for polling (Task 11.5)
// Task 11.1-11.6: Payment status polling endpoint for Flutter app
// This endpoint allows the Flutter app to poll for payment status after WebView closes
// Returns payment status, amount, and order details
// Note: This is a public endpoint (no authentication) as it's accessed after return URL redirect
router.get(
  '/status/:tx_ref',
  verifyLimiter, // Apply moderate rate limiting to prevent abuse
  paymentController.getPaymentStatus
);

// GET /api/payments/history - Get payment history with filtering (admin only)
router.get('/history', verifyToken, requireRole(['admin']), paymentController.getPaymentHistory);

// POST /api/payments/admin/verify/:reference - Manually verify payment (admin only)
router.post('/admin/verify/:reference', verifyToken, requireRole(['admin']), paymentController.adminVerifyPayment);

module.exports = router;
