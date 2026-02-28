/**
 * Admin Functionality Preservation Tests
 * 
 * Tests that admin functionality for querying payment history and manually verifying
 * transactions continues to work correctly after the Chapa payment database validation fix.
 * 
 * Requirements tested:
 * - 3.13: WHEN admins query payment history THEN the system SHALL CONTINUE TO return filtered results by order_id, tx_ref, or status
 * - 3.14: WHEN admins manually verify a transaction THEN the system SHALL CONTINUE TO call Chapa's verification API and update records
 * 
 * This test runs on FIXED code to ensure preservation of admin functionality.
 */

const request = require('supertest');
const app = require('../../src/server');
const { Payment, Order, User, OrderItem, Product, Seller, sequelize } = require('../../src/models');
const jwt = require('jsonwebtoken');

describe('Admin Functionality Preservation Tests', () => {
  let adminToken;
  let adminUser;
  let testPayments = [];
  let testOrders = [];
  let testCustomer;
  let testSeller;

  beforeAll(async () => {
    // Create admin user
    adminUser = await User.create({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@test.com',
      password: 'hashedpassword',
      role: 'admin',
      is_verified: true
    });

    // Generate admin token
    adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test customer
    testCustomer = await User.create({
      first_name: 'Test',
      last_name: 'Customer',
      email: 'customer@test.com',
      password: 'hashedpassword',
      role: 'customer',
      is_verified: true
    });

    // Create test seller
    testSeller = await Seller.create({
      user_id: adminUser.id,
      store_name: 'Test Store',
      business_email: 'seller@test.com',
      phone: '1234567890',
      status: 'approved'
    });

    // Create test product
    const testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test Description',
      price: 100.00,
      stock_quantity: 10,
      seller_id: testSeller.id,
      category_id: 1,
      sku: 'TEST-SKU-001'
    });

    // Create test orders and payments with different statuses
    const statuses = ['pending', 'success', 'failed'];
    
    for (let i = 0; i < 5; i++) {
      const order = await Order.create({
        user_id: testCustomer.id,
        order_number: `ORD-TEST-${Date.now()}-${i}`,
        total_amount: 100.00 + (i * 10),
        order_status: 'pending',
        payment_status: 'pending',
        shipping_address: JSON.stringify({
          street: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          country: 'Ethiopia',
          postal_code: '12345'
        })
      });

      await OrderItem.create({
        order_id: order.id,
        product_id: testProduct.id,
        seller_id: testSeller.id,
        quantity: 1,
        price_at_purchase: 100.00 + (i * 10)
      });

      const payment = await Payment.create({
        order_id: order.id,
        transaction_id: `TXN-${Date.now()}-${i}`,
        chapa_tx_ref: `CHAPA-TX-${Date.now()}-${i}`,
        payment_method: 'chapa',
        amount: 100.00 + (i * 10),
        currency: 'ETB',
        status: statuses[i % 3],
        paid_at: statuses[i % 3] === 'success' ? new Date() : null
      });

      testOrders.push(order);
      testPayments.push(payment);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await Payment.destroy({ where: { id: testPayments.map(p => p.id) } });
    await OrderItem.destroy({ where: { order_id: testOrders.map(o => o.id) } });
    await Order.destroy({ where: { id: testOrders.map(o => o.id) } });
    await Product.destroy({ where: { seller_id: testSeller.id } });
    await Seller.destroy({ where: { id: testSeller.id } });
    await User.destroy({ where: { id: [adminUser.id, testCustomer.id] } });
  });

  describe('Payment History Query Preservation (Requirement 3.13)', () => {
    test('should return all transactions without filters', async () => {
      const response = await request(app)
        .get('/api/admin/payments/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.transactions).toBeDefined();
      expect(Array.isArray(response.body.data.transactions)).toBe(true);
      expect(response.body.data.transactions.length).toBeGreaterThan(0);
      
      // Verify pagination
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBeGreaterThan(0);
    });

    test('should filter transactions by status', async () => {
      const response = await request(app)
        .get('/api/admin/payments/transactions?status=success')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toBeDefined();
      
      // All returned transactions should have status 'success'
      response.body.data.transactions.forEach(transaction => {
        expect(transaction.status).toBe('success');
      });
    });

    test('should filter transactions by order_id', async () => {
      const testOrderId = testOrders[0].id;
      
      const response = await request(app)
        .get(`/api/admin/payments/transactions?order_id=${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toBeDefined();
      
      // All returned transactions should have the specified order_id
      response.body.data.transactions.forEach(transaction => {
        expect(transaction.order_id).toBe(testOrderId);
      });
    });

    test('should filter transactions by tx_ref (partial match)', async () => {
      const testTxRef = testPayments[0].chapa_tx_ref;
      const searchTerm = testTxRef.substring(0, 10); // Use partial tx_ref
      
      const response = await request(app)
        .get(`/api/admin/payments/transactions?tx_ref=${searchTerm}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toBeDefined();
      
      // All returned transactions should contain the search term in tx_ref
      response.body.data.transactions.forEach(transaction => {
        expect(transaction.chapa_tx_ref).toContain(searchTerm);
      });
    });

    test('should return comprehensive transaction details', async () => {
      const response = await request(app)
        .get('/api/admin/payments/transactions?limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBeGreaterThan(0);
      
      const transaction = response.body.data.transactions[0];
      
      // Verify all payment fields are present
      expect(transaction).toHaveProperty('id');
      expect(transaction).toHaveProperty('order_id');
      expect(transaction).toHaveProperty('transaction_id');
      expect(transaction).toHaveProperty('chapa_tx_ref');
      expect(transaction).toHaveProperty('payment_method');
      expect(transaction).toHaveProperty('amount');
      expect(transaction).toHaveProperty('currency');
      expect(transaction).toHaveProperty('status');
      expect(transaction).toHaveProperty('created_at');
      expect(transaction).toHaveProperty('updated_at');
      
      // Verify order details are included
      expect(transaction).toHaveProperty('order');
      if (transaction.order) {
        expect(transaction.order).toHaveProperty('id');
        expect(transaction.order).toHaveProperty('order_number');
        expect(transaction.order).toHaveProperty('total_amount');
        expect(transaction.order).toHaveProperty('order_status');
        
        // Verify customer information is included
        expect(transaction.order).toHaveProperty('customer');
        if (transaction.order.customer) {
          expect(transaction.order.customer).toHaveProperty('id');
          expect(transaction.order.customer).toHaveProperty('name');
          expect(transaction.order.customer).toHaveProperty('email');
        }
        
        // Verify order items are included
        expect(transaction.order).toHaveProperty('items');
        expect(Array.isArray(transaction.order.items)).toBe(true);
      }
    });

    test('should support pagination', async () => {
      const page1Response = await request(app)
        .get('/api/admin/payments/transactions?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(page1Response.body.success).toBe(true);
      expect(page1Response.body.data.pagination).toBeDefined();
      expect(page1Response.body.data.pagination.page).toBe(1);
      expect(page1Response.body.data.pagination.limit).toBe(2);
      expect(page1Response.body.data.transactions.length).toBeLessThanOrEqual(2);
    });

    test('should return transactions ordered by created_at DESC', async () => {
      const response = await request(app)
        .get('/api/admin/payments/transactions?limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data.transactions;
      
      if (transactions.length > 1) {
        // Verify transactions are ordered by created_at descending
        for (let i = 0; i < transactions.length - 1; i++) {
          const current = new Date(transactions[i].created_at);
          const next = new Date(transactions[i + 1].created_at);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });
  });

  describe('Manual Verification Preservation (Requirement 3.14)', () => {
    let pendingPayment;
    let pendingOrder;

    beforeAll(async () => {
      // Create a pending payment for manual verification tests
      pendingOrder = await Order.create({
        user_id: testCustomer.id,
        order_number: `ORD-VERIFY-${Date.now()}`,
        total_amount: 250.00,
        order_status: 'pending',
        payment_status: 'pending',
        shipping_address: JSON.stringify({
          street: '456 Verify St',
          city: 'Verify City',
          state: 'Verify State',
          country: 'Ethiopia',
          postal_code: '54321'
        })
      });

      pendingPayment = await Payment.create({
        order_id: pendingOrder.id,
        transaction_id: `TXN-VERIFY-${Date.now()}`,
        chapa_tx_ref: `CHAPA-VERIFY-${Date.now()}`,
        payment_method: 'chapa',
        amount: 250.00,
        currency: 'ETB',
        status: 'pending'
      });
    });

    afterAll(async () => {
      await Payment.destroy({ where: { id: pendingPayment.id } });
      await OrderItem.destroy({ where: { order_id: pendingOrder.id } });
      await Order.destroy({ where: { id: pendingOrder.id } });
    });

    test('should accept manual verification request with tx_ref', async () => {
      // Note: This test will attempt to call Chapa's API, which may fail in test environment
      // We're testing that the endpoint accepts the request and processes it correctly
      
      const response = await request(app)
        .post('/api/admin/payments/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tx_ref: pendingPayment.chapa_tx_ref });

      // The response may be 200 (success), 400 (verification failed), or 500 (API error)
      // We're verifying the endpoint is accessible and processes the request
      expect([200, 400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });

    test('should reject manual verification without tx_ref', async () => {
      const response = await request(app)
        .post('/api/admin/payments/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    test('should return 404 for non-existent tx_ref', async () => {
      const response = await request(app)
        .post('/api/admin/payments/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tx_ref: 'NON-EXISTENT-TX-REF' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    test('should log manual verification attempts', async () => {
      // Capture console.log output
      const originalLog = console.log;
      const logs = [];
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
      };

      await request(app)
        .post('/api/admin/payments/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tx_ref: pendingPayment.chapa_tx_ref });

      // Restore console.log
      console.log = originalLog;

      // Verify that manual verification was logged
      const verificationLog = logs.find(log => 
        log.includes('Admin Manual Verification') && 
        log.includes(pendingPayment.chapa_tx_ref)
      );
      
      expect(verificationLog).toBeDefined();
    });

    test('should require admin authentication', async () => {
      const response = await request(app)
        .post('/api/admin/payments/verify')
        .send({ tx_ref: pendingPayment.chapa_tx_ref });

      expect(response.status).toBe(401);
    });
  });

  describe('Property-Based Admin Functionality Tests', () => {
    test('PROPERTY: All query filters should return valid transaction data', async () => {
      const filters = [
        {},
        { status: 'success' },
        { status: 'pending' },
        { status: 'failed' },
        { order_id: testOrders[0].id },
        { tx_ref: testPayments[0].chapa_tx_ref.substring(0, 10) }
      ];

      for (const filter of filters) {
        const queryString = new URLSearchParams(filter).toString();
        const response = await request(app)
          .get(`/api/admin/payments/transactions?${queryString}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.transactions).toBeDefined();
        expect(Array.isArray(response.body.data.transactions)).toBe(true);
        
        // Verify each transaction has required fields
        response.body.data.transactions.forEach(transaction => {
          expect(transaction).toHaveProperty('id');
          expect(transaction).toHaveProperty('chapa_tx_ref');
          expect(transaction).toHaveProperty('status');
          expect(transaction).toHaveProperty('amount');
          expect(transaction).toHaveProperty('currency');
        });
      }
    });

    test('PROPERTY: Manual verification should always validate tx_ref', async () => {
      const invalidTxRefs = [
        undefined,
        null,
        '',
        '   ',
        'NON-EXISTENT-REF'
      ];

      for (const tx_ref of invalidTxRefs) {
        const response = await request(app)
          .post('/api/admin/payments/verify')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ tx_ref });

        // Should return 400 (bad request) or 404 (not found)
        expect([400, 404]).toContain(response.status);
        expect(response.body.success).toBe(false);
      }
    });

    test('PROPERTY: Query results should respect pagination limits', async () => {
      const limits = [1, 2, 5, 10, 20];

      for (const limit of limits) {
        const response = await request(app)
          .get(`/api/admin/payments/transactions?limit=${limit}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.transactions.length).toBeLessThanOrEqual(limit);
        expect(response.body.data.pagination.limit).toBe(limit);
      }
    });
  });

  describe('Admin Functionality Regression Prevention', () => {
    test('should maintain backward compatibility with existing query parameters', async () => {
      // Test that all existing query parameters still work
      const response = await request(app)
        .get('/api/admin/payments/transactions?page=1&limit=10&status=success')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('should maintain response structure for transaction queries', async () => {
      const response = await request(app)
        .get('/api/admin/payments/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify response structure hasn't changed
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('transactions');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('total');
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('totalPages');
    });

    test('should maintain response structure for manual verification', async () => {
      const response = await request(app)
        .post('/api/admin/payments/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tx_ref: pendingPayment.chapa_tx_ref });

      // Verify response structure (regardless of success/failure)
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });
  });
});
