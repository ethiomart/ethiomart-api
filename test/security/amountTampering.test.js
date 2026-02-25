const request = require('supertest');
const app = require('../../src/server');
const { Payment, Order, User } = require('../../src/models');
const chapaService = require('../../src/services/chapaService');
const crypto = require('crypto');

/**
 * Security Test: Amount Tampering Prevention
 * Task 19.3.2: Test amount tampering prevention
 * 
 * Requirements: 4.4, 11.1, 12.2
 * Properties: 18, 44, 52
 * 
 * Tests:
 * - Amount mismatch detection in verification
 * - Currency mismatch detection
 * - Decimal precision validation
 * - Negative amount rejection
 * - Zero amount rejection
 * - Round-trip validation
 */

describe('Security: Amount Tampering Prevention', () => {
  let testOrder;
  let testPayment;
  let testUser;
  let authToken;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      email: 'amount-test@example.com',
      password: 'hashedpassword',
      first_name: 'Amount',
      last_name: 'Test',
      role: 'customer'
    });

    // Create test order
    testOrder = await Order.create({
      user_id: testUser.id,
      total_amount: 1500.00,
      order_status: 'pending',
      payment_status: 'pending',
      order_number: `ORD-${Date.now()}`
    });

    // Create test payment
    testPayment = await Payment.create({
      order_id: testOrder.id,
      amount: 1500.00,
      currency: 'ETB',
      status: 'pending',
      chapa_tx_ref: `test-ref-${Date.now()}`
    });

    // Generate auth token for authenticated requests
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterEach(async () => {
    // Clean up test data
    if (testPayment) await testPayment.destroy();
    if (testOrder) await testOrder.destroy();
    if (testUser) await testUser.destroy();
  });

  describe('Amount Mismatch Detection', () => {
    test('should reject verification when Chapa returns different amount', async () => {
      // Mock Chapa verification with different amount
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1400.00, // Different from expected 1500.00
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr',
        transactionId: 'chapa_12345'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Amount mismatch');
      expect(response.body.details).toEqual({
        expected: 1500.00,
        received: 1400.00
      });

      // Verify payment status was not updated
      await testPayment.reload();
      expect(testPayment.status).toBe('pending');

      chapaService.verifyPayment.mockRestore();
    });

    test('should reject verification when amount is higher than expected', async () => {
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 15000.00, // 10x higher
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Amount mismatch');

      chapaService.verifyPayment.mockRestore();
    });

    test('should reject verification when amount is lower than expected', async () => {
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 150.00, // 10x lower
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Amount mismatch');

      chapaService.verifyPayment.mockRestore();
    });

    test('should accept verification when amounts match exactly', async () => {
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.00, // Exact match
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr',
        transactionId: 'chapa_12345'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      chapaService.verifyPayment.mockRestore();
    });

    test('should handle floating point precision correctly', async () => {
      // Update payment with amount that has floating point precision issues
      await testPayment.update({ amount: 1500.99 });

      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.99, // Should match despite floating point
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      chapaService.verifyPayment.mockRestore();
    });

    test('should allow small rounding differences (within 0.01)', async () => {
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.005, // Rounds to 1500.01
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should accept within 0.01 tolerance
      expect(response.status).toBe(200);

      chapaService.verifyPayment.mockRestore();
    });
  });

  describe('Currency Mismatch Detection', () => {
    test('should reject verification when currency differs', async () => {
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.00,
        currency: 'USD', // Different from expected ETB
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'card'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Currency mismatch');
      expect(response.body.details).toEqual({
        expected: 'ETB',
        received: 'USD'
      });

      chapaService.verifyPayment.mockRestore();
    });

    test('should accept verification when currency matches', async () => {
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.00,
        currency: 'ETB', // Matches
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      chapaService.verifyPayment.mockRestore();
    });
  });

  describe('Payment Initialization Validation', () => {
    test('should reject payment initialization with negative amount', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: -100.00,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.amount).toBeDefined();
    });

    test('should reject payment initialization with zero amount', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: 0,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject payment initialization with invalid decimal precision', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: 1500.999, // More than 2 decimal places
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.amount).toContain('maximum 2 decimal places');
    });

    test('should accept payment initialization with valid amount', async () => {
      jest.spyOn(chapaService, 'initializePayment').mockResolvedValue({
        paymentUrl: 'https://checkout.chapa.co/test',
        reference: 'test-ref-123',
        paymentMethods: [],
        currency: 'ETB'
      });

      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: 1500.50,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      chapaService.initializePayment.mockRestore();
    });
  });

  describe('Webhook Amount Validation', () => {
    function generateValidSignature(payload) {
      const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || 'test-webhook-secret';
      return crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
    }

    test('should detect amount tampering in webhook', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '15000.00', // Tampered amount
        currency: 'ETB'
      };

      const signature = generateValidSignature(payload);

      // Mock verification to return correct amount
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.00, // Correct amount from Chapa
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', signature)
        .send(payload);

      // Webhook should be acknowledged but verification will catch mismatch
      expect(response.status).toBe(200);

      // Wait for async verification
      await new Promise(resolve => setTimeout(resolve, 100));

      // Payment should remain pending due to mismatch
      await testPayment.reload();
      expect(testPayment.status).not.toBe('success');

      chapaService.verifyPayment.mockRestore();
    });

    test('should not trust webhook amount without verification', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB'
      };

      const signature = generateValidSignature(payload);

      // Mock verification to return different amount
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1400.00, // Different from webhook
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);

      // Wait for async verification
      await new Promise(resolve => setTimeout(resolve, 100));

      // Payment should be failed due to verification mismatch
      await testPayment.reload();
      expect(testPayment.status).toBe('failed');

      chapaService.verifyPayment.mockRestore();
    });
  });

  describe('Round-Trip Validation', () => {
    test('should validate that verified amount matches initialized amount', async () => {
      // Initialize payment
      jest.spyOn(chapaService, 'initializePayment').mockResolvedValue({
        paymentUrl: 'https://checkout.chapa.co/test',
        reference: 'test-ref-roundtrip',
        paymentMethods: [],
        currency: 'ETB'
      });

      const initResponse = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: 2500.00,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(initResponse.status).toBe(200);
      const reference = initResponse.body.data.reference;

      // Find the created payment
      const payment = await Payment.findOne({ where: { chapa_tx_ref: reference } });

      // Verify with matching amount
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 2500.00, // Matches initialized amount
        currency: 'ETB',
        reference: reference,
        paymentMethod: 'telebirr'
      });

      const verifyResponse = await request(app)
        .get(`/api/payments/verify/${reference}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);

      // Clean up
      await payment.destroy();
      chapaService.initializePayment.mockRestore();
      chapaService.verifyPayment.mockRestore();
    });

    test('should reject when verified amount differs from initialized amount', async () => {
      // Initialize payment
      jest.spyOn(chapaService, 'initializePayment').mockResolvedValue({
        paymentUrl: 'https://checkout.chapa.co/test',
        reference: 'test-ref-mismatch',
        paymentMethods: [],
        currency: 'ETB'
      });

      const initResponse = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder.id,
          amount: 2500.00,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(initResponse.status).toBe(200);
      const reference = initResponse.body.data.reference;

      // Find the created payment
      const payment = await Payment.findOne({ where: { chapa_tx_ref: reference } });

      // Verify with different amount
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 2000.00, // Different from initialized 2500.00
        currency: 'ETB',
        reference: reference,
        paymentMethod: 'telebirr'
      });

      const verifyResponse = await request(app)
        .get(`/api/payments/verify/${reference}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(verifyResponse.status).toBe(400);
      expect(verifyResponse.body.error).toContain('Amount mismatch');

      // Clean up
      await payment.destroy();
      chapaService.initializePayment.mockRestore();
      chapaService.verifyPayment.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('should handle very large amounts correctly', async () => {
      const largeAmount = 999999.99;
      await testPayment.update({ amount: largeAmount });

      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: largeAmount,
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      chapaService.verifyPayment.mockRestore();
    });

    test('should handle very small amounts correctly', async () => {
      const smallAmount = 0.01;
      await testPayment.update({ amount: smallAmount });

      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: smallAmount,
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .get(`/api/payments/verify/${testPayment.chapa_tx_ref}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      chapaService.verifyPayment.mockRestore();
    });
  });
});
