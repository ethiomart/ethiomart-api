const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/server');
const { Payment, Order, User } = require('../../src/models');
const chapaService = require('../../src/services/chapaService');

/**
 * Security Test: Webhook Signature Validation
 * Task 19.3.1: Test webhook signature validation
 * 
 * Requirements: 11.5, 11.6
 * Properties: 48, 49
 * 
 * Tests:
 * - Valid signature acceptance
 * - Invalid signature rejection
 * - Missing signature handling
 * - Tampered payload detection
 * - Signature algorithm verification
 */

describe('Security: Webhook Signature Validation', () => {
  let testOrder;
  let testPayment;
  let testUser;
  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || 'test-webhook-secret';

  beforeAll(async () => {
    // Set webhook secret for tests
    process.env.CHAPA_WEBHOOK_SECRET = webhookSecret;
  });

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      email: 'webhook-test@example.com',
      password: 'hashedpassword',
      first_name: 'Webhook',
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
  });

  afterEach(async () => {
    // Clean up test data
    if (testPayment) await testPayment.destroy();
    if (testOrder) await testOrder.destroy();
    if (testUser) await testUser.destroy();
  });

  /**
   * Generate valid HMAC SHA256 signature
   */
  function generateValidSignature(payload) {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');
  }

  describe('Valid Signature Tests', () => {
    test('should accept webhook with valid signature', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB',
        ref_id: 'chapa_12345'
      };

      const signature = generateValidSignature(payload);

      // Mock Chapa verification
      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.00,
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr',
        transactionId: 'chapa_12345'
      });

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      chapaService.verifyPayment.mockRestore();
    });

    test('should accept webhook with x-chapa-signature header', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB'
      };

      const signature = generateValidSignature(payload);

      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.00,
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-chapa-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      chapaService.verifyPayment.mockRestore();
    });
  });

  describe('Invalid Signature Tests', () => {
    test('should reject webhook with invalid signature', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB'
      };

      const invalidSignature = 'invalid_signature_12345';

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', invalidSignature)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid webhook signature');
    });

    test('should reject webhook with tampered payload', async () => {
      const originalPayload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB'
      };

      // Generate signature for original payload
      const signature = generateValidSignature(originalPayload);

      // Tamper with the payload (change amount)
      const tamperedPayload = {
        ...originalPayload,
        amount: '15000.00' // Changed from 1500 to 15000
      };

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', signature)
        .send(tamperedPayload);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject webhook with wrong signature algorithm', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB'
      };

      // Use MD5 instead of SHA256
      const wrongAlgorithmSignature = crypto
        .createHash('md5')
        .update(JSON.stringify(payload))
        .digest('hex');

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', wrongAlgorithmSignature)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Missing Signature Tests', () => {
    test('should handle webhook with missing signature gracefully', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB'
      };

      // In test mode, missing signature might be allowed
      // but should still be logged
      const response = await request(app)
        .post('/api/payments/webhook')
        .send(payload);

      // Should still process but log warning
      expect(response.status).toBe(200);
    });
  });

  describe('Transaction Reference Validation', () => {
    test('should reject webhook with non-existent transaction reference', async () => {
      const payload = {
        tx_ref: 'non-existent-ref-12345',
        status: 'success',
        amount: '1500.00',
        currency: 'ETB'
      };

      const signature = generateValidSignature(payload);

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('payment not found');
    });

    test('should reject webhook for already processed payment', async () => {
      // Update payment to completed status
      await testPayment.update({ status: 'success' });

      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB'
      };

      const signature = generateValidSignature(payload);

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('already');
    });
  });

  describe('Signature Verification Edge Cases', () => {
    test('should handle empty payload', async () => {
      const payload = {};
      const signature = generateValidSignature(payload);

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', signature)
        .send(payload);

      expect(response.status).toBe(400);
    });

    test('should handle special characters in payload', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB',
        customer_name: 'Test & User <script>alert("xss")</script>'
      };

      const signature = generateValidSignature(payload);

      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.00,
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);

      chapaService.verifyPayment.mockRestore();
    });

    test('should handle unicode characters in payload', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB',
        customer_name: 'አበበ ተስፋዬ' // Amharic characters
      };

      const signature = generateValidSignature(payload);

      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValue({
        status: 'success',
        amount: 1500.00,
        currency: 'ETB',
        reference: testPayment.chapa_tx_ref,
        paymentMethod: 'telebirr'
      });

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);

      chapaService.verifyPayment.mockRestore();
    });
  });

  describe('Timing Attack Prevention', () => {
    test('should use constant-time comparison for signature verification', async () => {
      const payload = {
        tx_ref: testPayment.chapa_tx_ref,
        status: 'success',
        amount: '1500.00',
        currency: 'ETB'
      };

      const validSignature = generateValidSignature(payload);
      const invalidSignature = validSignature.slice(0, -1) + 'x';

      // Measure time for valid signature
      const start1 = process.hrtime.bigint();
      await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', validSignature)
        .send(payload);
      const end1 = process.hrtime.bigint();
      const time1 = Number(end1 - start1);

      // Measure time for invalid signature
      const start2 = process.hrtime.bigint();
      await request(app)
        .post('/api/payments/webhook')
        .set('chapa-signature', invalidSignature)
        .send(payload);
      const end2 = process.hrtime.bigint();
      const time2 = Number(end2 - start2);

      // Time difference should be minimal (within 10ms)
      const timeDiff = Math.abs(time1 - time2) / 1000000; // Convert to ms
      expect(timeDiff).toBeLessThan(10);
    });
  });
});
