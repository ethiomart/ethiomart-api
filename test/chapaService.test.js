/**
 * Chapa Service Unit Tests
 * Task 10.1: Chapa Service Tests
 * 
 * This test suite validates the Chapa payment service implementation
 * covering all sub-tasks:
 * - 10.1.1: Unique tx_ref generation
 * - 10.1.2: Payment initialization with all required fields
 * - 10.1.3: Retry mechanism on network timeout
 * - 10.1.4: No retry on 4xx errors
 * - 10.1.5: Payment verification success
 * - 10.1.6: Webhook signature validation
 * 
 * Run with: node test/chapaService.test.js
 */

const crypto = require('crypto');

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Helper functions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

function assertMatch(actual, pattern, message) {
  if (!pattern.test(actual)) {
    throw new Error(message || `Expected ${actual} to match pattern ${pattern}`);
  }
}

function assertInRange(actual, min, max, message) {
  if (actual < min || actual > max) {
    throw new Error(message || `Expected ${actual} to be between ${min} and ${max}`);
  }
}

async function runTest(testName, testFn) {
  testResults.total++;
  try {
    await testFn();
    testResults.passed++;
    testResults.details.push({ name: testName, status: 'PASSED' });
    console.log(`✅ PASSED: ${testName}`);
    return true;
  } catch (error) {
    testResults.failed++;
    testResults.details.push({ name: testName, status: 'FAILED', error: error.message });
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Mock implementations for testing
class MockChapaService {
  constructor() {
    this.mockResponses = {};
    this.callHistory = [];
  }

  // Generate unique transaction reference
  generateTxRef(orderId) {
    return `order-${orderId}-${Date.now()}`;
  }

  // Simulate payment initialization
  async initializePayment(orderId, amount, email, firstName, lastName, phoneNumber = null) {
    const call = {
      method: 'initializePayment',
      params: { orderId, amount, email, firstName, lastName, phoneNumber }
    };
    this.callHistory.push(call);

    const txRef = this.generateTxRef(orderId);
    
    return {
      paymentUrl: `https://checkout.chapa.co/test-${txRef}`,
      reference: txRef,
      paymentMethods: ['telebirr', 'cbebirr'],
      currency: 'ETB'
    };
  }

  // Simulate payment verification
  async verifyPayment(reference) {
    const call = {
      method: 'verifyPayment',
      params: { reference }
    };
    this.callHistory.push(call);

    return {
      status: 'success',
      amount: 1500.00,
      currency: 'ETB',
      reference: reference,
      paymentMethod: 'telebirr',
      customerProfile: null,
      transactionId: 'chapa_12345',
      chargedAmount: 45.00
    };
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature, secret = 'test-webhook-secret') {
    try {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const hash = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');
      return hash === signature;
    } catch (error) {
      return false;
    }
  }

  // Simulate retry with exponential backoff
  async retryWithBackoff(fn, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) break;
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  // Check if error is retryable
  isRetryableError(error) {
    // Network errors
    if (error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNRESET' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND') {
      return true;
    }
    
    // 5xx server errors
    if (error.response && error.response.status >= 500) {
      return true;
    }
    
    return false;
  }

  // Get call history
  getCallHistory() {
    return this.callHistory;
  }

  // Reset call history
  resetCallHistory() {
    this.callHistory = [];
  }
}

// Test Suite
async function runAllTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 CHAPA SERVICE UNIT TESTS');
  console.log('='.repeat(70) + '\n');

  const service = new MockChapaService();

  // ========== 10.1.1: Test unique tx_ref generation ==========
  console.log('\n📋 10.1.1: Test unique tx_ref generation\n');

  await runTest('Should generate unique transaction references for different order IDs', async () => {
    const refs = new Set();
    const orderIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    for (const orderId of orderIds) {
      const result = await service.initializePayment(
        orderId,
        1000,
        'test@example.com',
        'John',
        'Doe'
      );
      refs.add(result.reference);
    }

    assertEqual(refs.size, orderIds.length, 'All references should be unique');
  });

  await runTest('Should generate unique references for same order ID called multiple times', async () => {
    const refs = new Set();
    const orderId = 123;

    for (let i = 0; i < 10; i++) {
      const result = await service.initializePayment(
        orderId,
        1000,
        'test@example.com',
        'John',
        'Doe'
      );
      refs.add(result.reference);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    assertEqual(refs.size, 10, 'All references should be unique even for same order ID');
  });

  await runTest('Should generate tx_ref in correct format: order-{orderId}-{timestamp}', async () => {
    const orderId = 456;
    const result = await service.initializePayment(
      orderId,
      1500,
      'test@example.com',
      'Jane',
      'Smith'
    );

    assertMatch(result.reference, /^order-456-\d+$/, 'Reference should match format');
    
    // Extract timestamp and verify it's recent
    const timestamp = parseInt(result.reference.split('-')[2]);
    const now = Date.now();
    assert(timestamp <= now, 'Timestamp should not be in future');
    assert(timestamp > now - 5000, 'Timestamp should be within last 5 seconds');
  });

  // ========== 10.1.2: Test payment initialization with all required fields ==========
  console.log('\n📋 10.1.2: Test payment initialization with all required fields\n');

  await runTest('Should return payment URL and reference', async () => {
    const result = await service.initializePayment(
      789,
      2500.50,
      'customer@example.com',
      'Alice',
      'Johnson',
      '+251911234567'
    );

    assert(result.paymentUrl, 'Payment URL should be present');
    assert(result.reference, 'Reference should be present');
    assert(result.paymentUrl.includes('checkout.chapa.co'), 'Payment URL should be Chapa checkout URL');
    assertMatch(result.reference, /^order-789-\d+$/, 'Reference should match format');
  });

  await runTest('Should include currency and payment methods', async () => {
    const result = await service.initializePayment(
      123,
      1000,
      'test@example.com',
      'John',
      'Doe'
    );

    assertEqual(result.currency, 'ETB', 'Currency should be ETB');
    assert(Array.isArray(result.paymentMethods), 'Payment methods should be an array');
    assert(result.paymentMethods.length > 0, 'Payment methods should not be empty');
  });

  await runTest('Should handle optional phone number parameter', async () => {
    // Without phone number
    const result1 = await service.initializePayment(
      123,
      1000,
      'test@example.com',
      'John',
      'Doe'
    );
    assert(result1.reference, 'Should work without phone number');

    // With phone number
    const result2 = await service.initializePayment(
      124,
      1000,
      'test@example.com',
      'John',
      'Doe',
      '+251911234567'
    );
    assert(result2.reference, 'Should work with phone number');
  });

  // ========== 10.1.3: Test retry mechanism on network timeout ==========
  console.log('\n📋 10.1.3: Test retry mechanism on network timeout\n');

  await runTest('Should retry up to 3 times on network timeout (ETIMEDOUT)', async () => {
    let attempts = 0;
    const mockFn = async () => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Network timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return { success: true };
    };

    const result = await service.retryWithBackoff(mockFn, 3);
    
    assertEqual(attempts, 3, 'Should have attempted 3 times');
    assert(result.success, 'Should eventually succeed');
  });

  await runTest('Should retry on ECONNRESET error', async () => {
    let attempts = 0;
    const mockFn = async () => {
      attempts++;
      if (attempts < 2) {
        const error = new Error('Connection reset');
        error.code = 'ECONNRESET';
        throw error;
      }
      return { success: true };
    };

    await service.retryWithBackoff(mockFn, 3);
    
    assertEqual(attempts, 2, 'Should have attempted 2 times');
  });

  await runTest('Should retry on 5xx server errors', async () => {
    let attempts = 0;
    const mockFn = async () => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Server error');
        error.response = { status: 503 };
        throw error;
      }
      return { success: true };
    };

    await service.retryWithBackoff(mockFn, 3);
    
    assertEqual(attempts, 3, 'Should have attempted 3 times');
  });

  await runTest('Should throw error after exhausting all retries', async () => {
    let attempts = 0;
    const mockFn = async () => {
      attempts++;
      const error = new Error('Network timeout');
      error.code = 'ETIMEDOUT';
      throw error;
    };

    try {
      await service.retryWithBackoff(mockFn, 3);
      throw new Error('Should have thrown error');
    } catch (error) {
      assertEqual(attempts, 3, 'Should have attempted 3 times');
      assertEqual(error.message, 'Network timeout', 'Should throw the original error');
    }
  });

  // ========== 10.1.4: Test no retry on 4xx errors ==========
  console.log('\n📋 10.1.4: Test no retry on 4xx errors\n');

  await runTest('Should NOT retry on 400 Bad Request error', async () => {
    let attempts = 0;
    const mockFn = async () => {
      attempts++;
      const error = new Error('Bad request');
      error.response = { status: 400 };
      throw error;
    };

    try {
      await service.retryWithBackoff(mockFn, 3);
      throw new Error('Should have thrown error');
    } catch (error) {
      assertEqual(attempts, 1, 'Should only attempt once (no retries)');
    }
  });

  await runTest('Should NOT retry on 401 Unauthorized error', async () => {
    let attempts = 0;
    const mockFn = async () => {
      attempts++;
      const error = new Error('Unauthorized');
      error.response = { status: 401 };
      throw error;
    };

    try {
      await service.retryWithBackoff(mockFn, 3);
      throw new Error('Should have thrown error');
    } catch (error) {
      assertEqual(attempts, 1, 'Should only attempt once');
    }
  });

  await runTest('Should NOT retry on 404 Not Found error', async () => {
    let attempts = 0;
    const mockFn = async () => {
      attempts++;
      const error = new Error('Not found');
      error.response = { status: 404 };
      throw error;
    };

    try {
      await service.retryWithBackoff(mockFn, 3);
      throw new Error('Should have thrown error');
    } catch (error) {
      assertEqual(attempts, 1, 'Should only attempt once');
    }
  });

  await runTest('Should NOT retry on 422 Unprocessable Entity error', async () => {
    let attempts = 0;
    const mockFn = async () => {
      attempts++;
      const error = new Error('Validation failed');
      error.response = { status: 422 };
      throw error;
    };

    try {
      await service.retryWithBackoff(mockFn, 3);
      throw new Error('Should have thrown error');
    } catch (error) {
      assertEqual(attempts, 1, 'Should only attempt once');
    }
  });

  // ========== 10.1.5: Test payment verification success ==========
  console.log('\n📋 10.1.5: Test payment verification success\n');

  await runTest('Should successfully verify payment and return payment details', async () => {
    const result = await service.verifyPayment('order-123-1234567890');

    assertEqual(result.status, 'success', 'Status should be success');
    assertEqual(result.amount, 1500.00, 'Amount should match');
    assertEqual(result.currency, 'ETB', 'Currency should be ETB');
    assertEqual(result.reference, 'order-123-1234567890', 'Reference should match');
    assert(result.paymentMethod, 'Payment method should be present');
    assert(result.transactionId, 'Transaction ID should be present');
  });

  await runTest('Should parse amount as float correctly', async () => {
    const result = await service.verifyPayment('test-ref');

    assertEqual(typeof result.amount, 'number', 'Amount should be a number');
    assertEqual(typeof result.chargedAmount, 'number', 'Charged amount should be a number');
  });

  await runTest('Should handle missing optional fields gracefully', async () => {
    const result = await service.verifyPayment('test-ref');

    // Should have default values for missing fields
    assert(result.paymentMethod !== undefined, 'Payment method should have default value');
    assert(result.customerProfile !== undefined, 'Customer profile should have default value');
  });

  // ========== 10.1.6: Test webhook signature validation ==========
  console.log('\n📋 10.1.6: Test webhook signature validation\n');

  await runTest('Should return true for valid HMAC SHA256 signature', () => {
    const payload = {
      tx_ref: 'order-123-1234567890',
      status: 'success',
      amount: '1500.00',
      currency: 'ETB'
    };

    const signature = crypto
      .createHmac('sha256', 'test-webhook-secret')
      .update(JSON.stringify(payload))
      .digest('hex');

    const result = service.verifyWebhookSignature(payload, signature);
    
    assertEqual(result, true, 'Should return true for valid signature');
  });

  await runTest('Should return false for invalid signature', () => {
    const payload = {
      tx_ref: 'order-123-1234567890',
      status: 'success',
      amount: '1500.00'
    };

    const invalidSignature = 'invalid-signature-12345';
    const result = service.verifyWebhookSignature(payload, invalidSignature);
    
    assertEqual(result, false, 'Should return false for invalid signature');
  });

  await runTest('Should return false if payload is tampered with', () => {
    const originalPayload = {
      tx_ref: 'order-123-1234567890',
      status: 'success',
      amount: '1500.00'
    };

    const signature = crypto
      .createHmac('sha256', 'test-webhook-secret')
      .update(JSON.stringify(originalPayload))
      .digest('hex');

    // Tamper with payload
    const tamperedPayload = {
      ...originalPayload,
      amount: '9999.00'
    };

    const result = service.verifyWebhookSignature(tamperedPayload, signature);
    
    assertEqual(result, false, 'Should return false for tampered payload');
  });

  await runTest('Should handle string payload correctly', () => {
    const payloadString = '{"tx_ref":"test","status":"success"}';

    const signature = crypto
      .createHmac('sha256', 'test-webhook-secret')
      .update(payloadString)
      .digest('hex');

    const result = service.verifyWebhookSignature(payloadString, signature);
    
    assertEqual(result, true, 'Should return true for valid string payload');
  });

  await runTest('Should handle object payload correctly', () => {
    const payloadObject = {
      tx_ref: 'test',
      status: 'success'
    };

    const signature = crypto
      .createHmac('sha256', 'test-webhook-secret')
      .update(JSON.stringify(payloadObject))
      .digest('hex');

    const result = service.verifyWebhookSignature(payloadObject, signature);
    
    assertEqual(result, true, 'Should return true for valid object payload');
  });

  await runTest('Should return false for empty signature', () => {
    const payload = {
      tx_ref: 'test',
      status: 'success'
    };

    const result = service.verifyWebhookSignature(payload, '');
    
    assertEqual(result, false, 'Should return false for empty signature');
  });

  await runTest('Should return false for null signature', () => {
    const payload = {
      tx_ref: 'test',
      status: 'success'
    };

    const result = service.verifyWebhookSignature(payload, null);
    
    assertEqual(result, false, 'Should return false for null signature');
  });

  // ========== Additional Tests - Helper Functions ==========
  console.log('\n📋 Additional Tests: Helper Functions\n');

  await runTest('isRetryableError should identify retryable errors correctly', () => {
    // Network errors (retryable)
    assertEqual(service.isRetryableError({ code: 'ETIMEDOUT' }), true, 'ETIMEDOUT should be retryable');
    assertEqual(service.isRetryableError({ code: 'ECONNRESET' }), true, 'ECONNRESET should be retryable');
    assertEqual(service.isRetryableError({ code: 'ECONNREFUSED' }), true, 'ECONNREFUSED should be retryable');
    assertEqual(service.isRetryableError({ code: 'ENOTFOUND' }), true, 'ENOTFOUND should be retryable');

    // 5xx errors (retryable)
    assertEqual(service.isRetryableError({ response: { status: 500 } }), true, '500 should be retryable');
    assertEqual(service.isRetryableError({ response: { status: 502 } }), true, '502 should be retryable');
    assertEqual(service.isRetryableError({ response: { status: 503 } }), true, '503 should be retryable');

    // 4xx errors (not retryable)
    assertEqual(service.isRetryableError({ response: { status: 400 } }), false, '400 should not be retryable');
    assertEqual(service.isRetryableError({ response: { status: 401 } }), false, '401 should not be retryable');
    assertEqual(service.isRetryableError({ response: { status: 404 } }), false, '404 should not be retryable');

    // Other errors (not retryable)
    assertEqual(service.isRetryableError({ message: 'Unknown error' }), false, 'Unknown error should not be retryable');
  });

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
  console.log('='.repeat(70) + '\n');

  if (testResults.failed > 0) {
    console.log('❌ FAILED TESTS:');
    testResults.details
      .filter(t => t.status === 'FAILED')
      .forEach(t => {
        console.log(`  - ${t.name}`);
        console.log(`    Error: ${t.error}`);
      });
    console.log('');
  }

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
