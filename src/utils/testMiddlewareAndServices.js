/**
 * Comprehensive Test Suite for Middleware and Services
 * Task 10: Checkpoint - Verify middleware and services
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');

// Test results storage
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper to log test results
function logTest(category, testName, passed, details = '') {
  const result = { category, testName, details };
  if (passed) {
    testResults.passed.push(result);
    console.log(`✓ [${category}] ${testName}`);
  } else {
    testResults.failed.push(result);
    console.log(`✗ [${category}] ${testName}`);
    if (details) console.log(`  Details: ${details}`);
  }
}

function logWarning(category, message) {
  testResults.warnings.push({ category, message });
  console.log(`⚠ [${category}] ${message}`);
}

// ============================================================================
// MIDDLEWARE TESTS
// ============================================================================

async function testAuthMiddleware() {
  console.log('\n=== Testing Authentication Middleware ===\n');
  
  const { verifyToken, requireRole, optionalAuth } = require('../middleware/auth');
  const { User } = require('../models');
  
  // Test 1: verifyToken - Valid token
  try {
    const testUser = await User.findOne({ where: { email: 'test@example.com' } });
    if (!testUser) {
      logWarning('Auth Middleware', 'No test user found. Create a test user first.');
    } else {
      const token = jwt.sign(
        { id: testUser.id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      await verifyToken(req, res, next);
      
      logTest('Auth Middleware', 'verifyToken with valid token', 
        nextCalled && req.user && req.user.id === testUser.id,
        nextCalled ? 'Token verified and user attached' : 'Next not called or user not attached'
      );
    }
  } catch (error) {
    logTest('Auth Middleware', 'verifyToken with valid token', false, error.message);
  }
  
  // Test 2: verifyToken - Missing token
  try {
    const req = { headers: {} };
    let statusCode, responseData;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
      }
    };
    const next = () => {};
    
    await verifyToken(req, res, next);
    
    logTest('Auth Middleware', 'verifyToken without token returns 401',
      statusCode === 401 && responseData.error.code === 'NO_TOKEN',
      `Status: ${statusCode}, Code: ${responseData?.error?.code}`
    );
  } catch (error) {
    logTest('Auth Middleware', 'verifyToken without token returns 401', false, error.message);
  }
  
  // Test 3: verifyToken - Invalid token
  try {
    const req = {
      headers: { authorization: 'Bearer invalid.token.here' }
    };
    let statusCode, responseData;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
      }
    };
    const next = () => {};
    
    await verifyToken(req, res, next);
    
    logTest('Auth Middleware', 'verifyToken with invalid token returns 401',
      statusCode === 401 && responseData.error.code === 'INVALID_TOKEN',
      `Status: ${statusCode}, Code: ${responseData?.error?.code}`
    );
  } catch (error) {
    logTest('Auth Middleware', 'verifyToken with invalid token returns 401', false, error.message);
  }
  
  // Test 4: requireRole - Authorized role
  try {
    const middleware = requireRole(['admin', 'seller']);
    const req = { user: { id: 1, role: 'seller' } };
    let nextCalled = false;
    const res = {};
    const next = () => { nextCalled = true; };
    
    middleware(req, res, next);
    
    logTest('Auth Middleware', 'requireRole allows authorized role',
      nextCalled,
      'Next called for authorized role'
    );
  } catch (error) {
    logTest('Auth Middleware', 'requireRole allows authorized role', false, error.message);
  }
  
  // Test 5: requireRole - Unauthorized role
  try {
    const middleware = requireRole(['admin']);
    const req = { user: { id: 1, role: 'customer' } };
    let statusCode, responseData;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
      }
    };
    const next = () => {};
    
    middleware(req, res, next);
    
    logTest('Auth Middleware', 'requireRole denies unauthorized role',
      statusCode === 403 && responseData.error.code === 'FORBIDDEN',
      `Status: ${statusCode}, Code: ${responseData?.error?.code}`
    );
  } catch (error) {
    logTest('Auth Middleware', 'requireRole denies unauthorized role', false, error.message);
  }
  
  // Test 6: optionalAuth - With valid token
  try {
    const testUser = await User.findOne({ where: { email: 'test@example.com' } });
    if (testUser) {
      const token = jwt.sign(
        { id: testUser.id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      await optionalAuth(req, res, next);
      
      logTest('Auth Middleware', 'optionalAuth attaches user with valid token',
        nextCalled && req.user && req.user.id === testUser.id,
        'User attached with valid token'
      );
    }
  } catch (error) {
    logTest('Auth Middleware', 'optionalAuth attaches user with valid token', false, error.message);
  }
  
  // Test 7: optionalAuth - Without token
  try {
    const req = { headers: {} };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    
    await optionalAuth(req, res, next);
    
    logTest('Auth Middleware', 'optionalAuth continues without token',
      nextCalled && req.user === null,
      'Next called with user set to null'
    );
  } catch (error) {
    logTest('Auth Middleware', 'optionalAuth continues without token', false, error.message);
  }
}

async function testValidationMiddleware() {
  console.log('\n=== Testing Validation Middleware ===\n');
  
  const {
    validateRegistration,
    validateLogin,
    validateProduct,
    validateCartItem,
    validateOrder,
    validateReview,
    handleValidationErrors
  } = require('../middleware/validation');
  
  // Test 1: Validation rules exist
  logTest('Validation Middleware', 'validateRegistration exists',
    Array.isArray(validateRegistration) && validateRegistration.length > 0,
    `${validateRegistration.length} validation rules`
  );
  
  logTest('Validation Middleware', 'validateLogin exists',
    Array.isArray(validateLogin) && validateLogin.length > 0,
    `${validateLogin.length} validation rules`
  );
  
  logTest('Validation Middleware', 'validateProduct exists',
    Array.isArray(validateProduct) && validateProduct.length > 0,
    `${validateProduct.length} validation rules`
  );
  
  logTest('Validation Middleware', 'validateCartItem exists',
    Array.isArray(validateCartItem) && validateCartItem.length > 0,
    `${validateCartItem.length} validation rules`
  );
  
  logTest('Validation Middleware', 'validateOrder exists',
    Array.isArray(validateOrder) && validateOrder.length > 0,
    `${validateOrder.length} validation rules`
  );
  
  logTest('Validation Middleware', 'validateReview exists',
    Array.isArray(validateReview) && validateReview.length > 0,
    `${validateReview.length} validation rules`
  );
  
  logTest('Validation Middleware', 'handleValidationErrors is a function',
    typeof handleValidationErrors === 'function',
    'Error handler function exists'
  );
}

async function testUploadMiddleware() {
  console.log('\n=== Testing Upload Middleware ===\n');
  
  const {
    uploadSingle,
    uploadMultiple,
    ALLOWED_IMAGE_TYPES,
    MAX_FILE_SIZE
  } = require('../middleware/upload');
  
  // Test 1: Constants are defined
  logTest('Upload Middleware', 'ALLOWED_IMAGE_TYPES defined',
    Array.isArray(ALLOWED_IMAGE_TYPES) && ALLOWED_IMAGE_TYPES.length === 3,
    `Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
  );
  
  logTest('Upload Middleware', 'MAX_FILE_SIZE defined',
    MAX_FILE_SIZE === 5 * 1024 * 1024,
    `Max size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
  );
  
  // Test 2: Upload functions exist
  logTest('Upload Middleware', 'uploadSingle is a function',
    typeof uploadSingle === 'function',
    'Single upload function exists'
  );
  
  logTest('Upload Middleware', 'uploadMultiple is a function',
    typeof uploadMultiple === 'function',
    'Multiple upload function exists'
  );
  
  // Test 3: Verify allowed image types
  const expectedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const hasAllTypes = expectedTypes.every(type => ALLOWED_IMAGE_TYPES.includes(type));
  
  logTest('Upload Middleware', 'All required image types allowed',
    hasAllTypes,
    `Expected: ${expectedTypes.join(', ')}`
  );
}

async function testErrorHandlerMiddleware() {
  console.log('\n=== Testing Error Handler Middleware ===\n');
  
  const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
  
  // Test 1: Functions exist
  logTest('Error Handler', 'errorHandler is a function',
    typeof errorHandler === 'function',
    'Error handler function exists'
  );
  
  logTest('Error Handler', 'notFoundHandler is a function',
    typeof notFoundHandler === 'function',
    'Not found handler function exists'
  );
  
  // Test 2: errorHandler handles 500 errors
  try {
    const err = new Error('Test error');
    const req = { originalUrl: '/test', method: 'GET' };
    let statusCode, responseData;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
      }
    };
    const next = () => {};
    
    errorHandler(err, req, res, next);
    
    logTest('Error Handler', 'errorHandler returns 500 for generic errors',
      statusCode === 500 && responseData.success === false,
      `Status: ${statusCode}`
    );
  } catch (error) {
    logTest('Error Handler', 'errorHandler returns 500 for generic errors', false, error.message);
  }
  
  // Test 3: notFoundHandler returns 404
  try {
    const req = { originalUrl: '/nonexistent', method: 'GET' };
    let statusCode, responseData;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
      }
    };
    const next = () => {};
    
    notFoundHandler(req, res, next);
    
    logTest('Error Handler', 'notFoundHandler returns 404',
      statusCode === 404 && responseData.error.statusCode === 404,
      `Status: ${statusCode}, Path: ${responseData.error.path}`
    );
  } catch (error) {
    logTest('Error Handler', 'notFoundHandler returns 404', false, error.message);
  }
}

// ============================================================================
// SERVICE TESTS
// ============================================================================

async function testChapaService() {
  console.log('\n=== Testing Chapa Service ===\n');
  
  const chapaService = require('../services/chapaService');
  const chapaConfig = require('../config/chapa');
  
  // Test 1: Service functions exist
  logTest('Chapa Service', 'initializePayment function exists',
    typeof chapaService.initializePayment === 'function',
    'Payment initialization function exists'
  );
  
  logTest('Chapa Service', 'verifyPayment function exists',
    typeof chapaService.verifyPayment === 'function',
    'Payment verification function exists'
  );
  
  logTest('Chapa Service', 'verifyWebhookSignature function exists',
    typeof chapaService.verifyWebhookSignature === 'function',
    'Webhook verification function exists'
  );
  
  // Test 2: Configuration is loaded
  logTest('Chapa Service', 'Chapa configuration loaded',
    chapaConfig.secretKey && chapaConfig.apiUrl && chapaConfig.webhookSecret,
    'All required config values present'
  );
  
  // Test 3: Webhook signature verification
  try {
    const testPayload = { tx_ref: 'test-123', status: 'success', amount: 100 };
    const testSecret = 'test-webhook-secret';
    
    // Generate valid signature
    const validSignature = crypto
      .createHmac('sha256', testSecret)
      .update(JSON.stringify(testPayload))
      .digest('hex');
    
    // Temporarily override config for test
    const originalSecret = chapaConfig.webhookSecret;
    chapaConfig.webhookSecret = testSecret;
    
    const isValid = chapaService.verifyWebhookSignature(testPayload, validSignature);
    
    // Restore original config
    chapaConfig.webhookSecret = originalSecret;
    
    logTest('Chapa Service', 'verifyWebhookSignature validates correct signature',
      isValid === true,
      'Valid signature accepted'
    );
  } catch (error) {
    logTest('Chapa Service', 'verifyWebhookSignature validates correct signature', false, error.message);
  }
  
  // Test 4: Webhook signature rejection
  try {
    const testPayload = { tx_ref: 'test-123', status: 'success', amount: 100 };
    const invalidSignature = 'invalid-signature-here';
    
    const isValid = chapaService.verifyWebhookSignature(testPayload, invalidSignature);
    
    logTest('Chapa Service', 'verifyWebhookSignature rejects invalid signature',
      isValid === false,
      'Invalid signature rejected'
    );
  } catch (error) {
    logTest('Chapa Service', 'verifyWebhookSignature rejects invalid signature', false, error.message);
  }
  
  // Warning about live API testing
  if (chapaConfig.secretKey && !chapaConfig.secretKey.includes('test')) {
    logWarning('Chapa Service', 
      'Chapa secret key appears to be production. Skipping live API tests to avoid charges.'
    );
  } else {
    logWarning('Chapa Service',
      'Live Chapa API tests skipped. To test with sandbox, ensure CHAPA_SECRET_KEY is set in .env'
    );
  }
}

async function testEmailService() {
  console.log('\n=== Testing Email Service ===\n');
  
  const emailService = require('../services/emailService');
  
  // Test 1: Service functions exist
  logTest('Email Service', 'sendWelcomeEmail function exists',
    typeof emailService.sendWelcomeEmail === 'function',
    'Welcome email function exists'
  );
  
  logTest('Email Service', 'sendOrderConfirmation function exists',
    typeof emailService.sendOrderConfirmation === 'function',
    'Order confirmation function exists'
  );
  
  logTest('Email Service', 'sendPaymentReceipt function exists',
    typeof emailService.sendPaymentReceipt === 'function',
    'Payment receipt function exists'
  );
  
  // Test 2: Check email configuration
  const hasEmailConfig = process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS;
  
  if (hasEmailConfig) {
    logTest('Email Service', 'Email configuration present',
      true,
      `Host: ${process.env.EMAIL_HOST}, User: ${process.env.EMAIL_USER}`
    );
  } else {
    logWarning('Email Service',
      'Email configuration missing in .env. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS to test email sending.'
    );
  }
  
  // Warning about live email testing
  logWarning('Email Service',
    'Live email tests skipped to avoid sending test emails. Functions are verified to exist.'
  );
}

async function testNotificationService() {
  console.log('\n=== Testing Notification Service ===\n');
  
  const notificationService = require('../services/notificationService');
  
  // Test 1: Service functions exist
  const functions = [
    'createNotification',
    'notifyOrderStatus',
    'notifySeller',
    'notifySellerNewOrder',
    'notifyPaymentStatus',
    'getUserNotifications',
    'markAsRead',
    'markAllAsRead',
    'deleteNotification',
    'getUnreadCount'
  ];
  
  functions.forEach(funcName => {
    logTest('Notification Service', `${funcName} function exists`,
      typeof notificationService[funcName] === 'function',
      `Function ${funcName} is available`
    );
  });
  
  // Test 2: Check if Notification model exists
  try {
    const { Notification } = require('../models');
    logTest('Notification Service', 'Notification model exists',
      Notification !== undefined,
      'Model is available for service'
    );
  } catch (error) {
    logTest('Notification Service', 'Notification model exists', false, error.message);
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Task 10: Middleware and Services Verification Tests      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // Test middleware
    await testAuthMiddleware();
    await testValidationMiddleware();
    await testUploadMiddleware();
    await testErrorHandlerMiddleware();
    
    // Test services
    await testChapaService();
    await testEmailService();
    await testNotificationService();
    
    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST SUMMARY                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log(`✓ Passed: ${testResults.passed.length}`);
    console.log(`✗ Failed: ${testResults.failed.length}`);
    console.log(`⚠ Warnings: ${testResults.warnings.length}\n`);
    
    if (testResults.failed.length > 0) {
      console.log('Failed Tests:');
      testResults.failed.forEach(test => {
        console.log(`  - [${test.category}] ${test.testName}`);
        if (test.details) console.log(`    ${test.details}`);
      });
      console.log('');
    }
    
    if (testResults.warnings.length > 0) {
      console.log('Warnings:');
      testResults.warnings.forEach(warning => {
        console.log(`  - [${warning.category}] ${warning.message}`);
      });
      console.log('');
    }
    
    // Exit with appropriate code
    if (testResults.failed.length > 0) {
      console.log('❌ Some tests failed. Please review the failures above.\n');
      process.exit(1);
    } else {
      console.log('✅ All tests passed! Middleware and services are working correctly.\n');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Test suite encountered an error:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
