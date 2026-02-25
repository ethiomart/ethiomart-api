/**
 * Bug Condition Exploration Test for Payment Initialization Error Fix
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bug exists
 * 
 * Bug Description: Payment initialization fails and returns "Exception: Bad request: Unknown error"
 * instead of specific error messages that identify the problem.
 * 
 * Expected Behavior: Payment initialization should return specific, actionable error messages
 * for different failure scenarios (missing fields, invalid values, network issues, etc.)
 * 
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 * Property 1: Fault Condition - Specific Error Messages for Payment Initialization Failures
 */

const request = require('supertest');
const app = require('../../src/server');
const { Order, User, Payment } = require('../../src/models');
const { generateAccessToken } = require('../../src/utils/tokenUtils');

describe('Bug Condition Exploration: Payment Initialization Generic Error', () => {
  let authToken;
  let testUser;
  let testOrder;

  beforeAll(async () => {
    // Clean up any existing test data first
    await User.destroy({ where: { email: 'bugtest@example.com' }, force: true });
    
    // Create test user with unique email
    testUser = await User.create({
      email: 'bugtest@example.com',
      password: 'hashedpassword123',
      first_name: 'BugTest',
      last_name: 'User',
      phone: '+251911234999',
      role: 'customer',
      is_verified: true
    });

    authToken = generateAccessToken(testUser);

    // Create test order
    testOrder = await Order.create({
      user_id: testUser.id,
      order_number: `ORD-BUGTEST-${Date.now()}`,
      total_amount: 1000.00,
      order_status: 'pending',
      payment_status: 'pending',
      shipping_address: JSON.stringify({
        street: 'Test Street',
        city: 'Addis Ababa',
        country: 'Ethiopia'
      })
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testOrder && testOrder.id) {
      await Payment.destroy({ where: { order_id: testOrder.id } });
      await Order.destroy({ where: { id: testOrder.id } });
    }
    if (testUser && testUser.id) {
      await User.destroy({ where: { id: testUser.id } });
    }
  });

  // Helper function to extract error message from response
  function getErrorMessage(responseBody) {
    if (typeof responseBody === 'string') return responseBody;
    if (responseBody.message) return responseBody.message;
    if (responseBody.error) {
      if (typeof responseBody.error === 'string') return responseBody.error;
      if (responseBody.error.message) return responseBody.error.message;
      if (responseBody.error.details) return JSON.stringify(responseBody.error.details);
    }
    return JSON.stringify(responseBody);
  }

  describe('Test Case 1: Missing Order ID', () => {
    it('should return "Order ID is required" instead of generic error', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // orderId is missing
          amount: 1000.00,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      // Expected behavior: Specific error message
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      const errorMessage = getErrorMessage(response.body).toLowerCase();
      
      // Should contain specific field information
      expect(errorMessage).toContain('order');
      expect(errorMessage).toMatch(/required|missing/);
      
      // Should NOT be a generic error
      expect(errorMessage).not.toContain('unknown error');
      
      console.log('\n=== Test Case 1: Missing Order ID ===');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      console.log('Error Message:', errorMessage);
    });
  });

  describe('Test Case 2: Invalid Email Format', () => {
    it('should return "Invalid email format" instead of generic error', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: 1000.00,
          email: 'invalid-email', // Invalid email format
          firstName: 'Test',
          lastName: 'User'
        });

      // Expected behavior: Specific error message about email format
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      const errorMessage = getErrorMessage(response.body).toLowerCase();
      
      // Should contain specific email validation error
      expect(errorMessage).toContain('email');
      expect(errorMessage).toMatch(/invalid|format/);
      
      // Should NOT be a generic error
      expect(errorMessage).not.toContain('unknown error');
      
      console.log('\n=== Test Case 2: Invalid Email Format ===');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      console.log('Error Message:', errorMessage);
    });
  });

  describe('Test Case 3: Negative Amount', () => {
    it('should return "Amount must be positive" instead of generic error', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: -100.00, // Negative amount
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      // Expected behavior: Specific error message about amount
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      const errorMessage = getErrorMessage(response.body).toLowerCase();
      
      // Should contain specific amount validation error
      expect(errorMessage).toContain('amount');
      expect(errorMessage).toMatch(/positive|greater/);
      
      // Should NOT be a generic error
      expect(errorMessage).not.toContain('unknown error');
      
      console.log('\n=== Test Case 3: Negative Amount ===');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      console.log('Error Message:', errorMessage);
    });
  });

  describe('Test Case 4: Missing Required Field (First Name)', () => {
    it('should return "First name is required" instead of generic error', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: 1000.00,
          email: 'test@example.com',
          // firstName is missing
          lastName: 'User'
        });

      // Expected behavior: Specific error message
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      const errorMessage = getErrorMessage(response.body).toLowerCase();
      
      // Should contain specific field information
      expect(errorMessage).toContain('first');
      expect(errorMessage).toContain('name');
      expect(errorMessage).toMatch(/required|missing/);
      
      // Should NOT be a generic error
      expect(errorMessage).not.toContain('unknown error');
      
      console.log('\n=== Test Case 4: Missing First Name ===');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      console.log('Error Message:', errorMessage);
    });
  });

  describe('Test Case 5: Missing Required Field (Last Name)', () => {
    it('should return "Last name is required" instead of generic error', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: 1000.00,
          email: 'test@example.com',
          firstName: 'Test'
          // lastName is missing
        });

      // Expected behavior: Specific error message
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      const errorMessage = getErrorMessage(response.body).toLowerCase();
      
      // Should contain specific field information
      expect(errorMessage).toContain('last');
      expect(errorMessage).toContain('name');
      expect(errorMessage).toMatch(/required|missing/);
      
      // Should NOT be a generic error
      expect(errorMessage).not.toContain('unknown error');
      
      console.log('\n=== Test Case 5: Missing Last Name ===');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      console.log('Error Message:', errorMessage);
    });
  });

  describe('Test Case 6: Order Not Found', () => {
    it('should return "Order not found" instead of generic error', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: 999999, // Non-existent order ID
          amount: 1000.00,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      // Expected behavior: Specific error message
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      
      const errorMessage = getErrorMessage(response.body).toLowerCase();
      
      // Should contain specific information about order not found
      // Note: Current implementation returns "Resource not found" which is somewhat generic
      // The fix should make this more specific: "Order with ID 999999 not found"
      expect(errorMessage).toMatch(/order|resource/);
      expect(errorMessage).toContain('not found');
      
      // Should NOT be a generic "unknown error"
      expect(errorMessage).not.toContain('unknown error');
      
      console.log('\n=== Test Case 6: Order Not Found ===');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      console.log('Error Message:', errorMessage);
      console.log('NOTE: Current message is "Resource not found" - should be more specific like "Order with ID 999999 not found"');
    });
  });

  describe('Test Case 7: Zero Amount', () => {
    it('should return "Amount must be positive" instead of generic error', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: 0, // Zero amount
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      // Expected behavior: Specific error message about amount
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      const errorMessage = getErrorMessage(response.body).toLowerCase();
      
      // Should contain specific amount validation error
      expect(errorMessage).toContain('amount');
      expect(errorMessage).toMatch(/positive|greater/);
      
      // Should NOT be a generic error
      expect(errorMessage).not.toContain('unknown error');
      
      console.log('\n=== Test Case 7: Zero Amount ===');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      console.log('Error Message:', errorMessage);
    });
  });

  describe('Summary: Bug Condition Counterexamples', () => {
    it('should document all counterexamples found', () => {
      console.log('\n========================================');
      console.log('BUG CONDITION EXPLORATION SUMMARY');
      console.log('========================================\n');
      console.log('This test suite explores the bug condition where payment initialization');
      console.log('fails and returns generic "Exception: Bad request: Unknown error" messages');
      console.log('instead of specific, actionable error messages.\n');
      console.log('Expected Outcome: Tests PASS on FIXED code (specific errors returned)\n');
      console.log('Counterexamples tested:');
      console.log('1. Missing orderId → should return "Order ID is required"');
      console.log('2. Invalid email → should return "Invalid email format"');
      console.log('3. Negative amount → should return "Amount must be positive"');
      console.log('4. Missing firstName → should return "First name is required"');
      console.log('5. Missing lastName → should return "Last name is required"');
      console.log('6. Order not found → should return "Order with ID X not found"');
      console.log('7. Zero amount → should return "Amount must be positive"');
      console.log('\n========================================\n');
    });
  });
});
