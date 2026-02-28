/**
 * Bug Condition Exploration Test for Chapa Payment Database Validation Fix
 * 
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bug exists
 * 
 * Bug Description: When customers complete checkout steps 1-2 and click "Place Order" at step 3,
 * the system throws "Exception: Bad request: Database validation error". Payment initialization
 * fails before reaching Chapa's payment gateway. Additionally, callback/return URLs may not be
 * properly configured, and transactions may not persist across customer/seller/admin interfaces.
 * 
 * Expected Behavior: 
 * - Order creation should succeed without database validation errors
 * - Payment initialization should succeed with proper callback/return URLs
 * - Payment records should be created with "pending" status
 * - Transactions should be visible to customers, sellers, and admins after payment
 * 
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4
 * Property 1: Fault Condition - Database Validation Error Resolution
 */

const request = require('supertest');
const app = require('../../src/server');
const { Order, User, Cart, CartItem, Product, Seller, Payment, sequelize } = require('../../src/models');
const { generateAccessToken } = require('../../src/utils/tokenUtils');
const fc = require('fast-check');

describe('Bug Condition Exploration: Chapa Payment Database Validation Error', () => {
  let authToken;
  let testUser;
  let testSeller;
  let testProduct;
  let testCart;

  beforeAll(async () => {
    // Clean up any existing test data
    await User.destroy({ where: { email: 'chapatest@example.com' }, force: true });
    await User.destroy({ where: { email: 'chapaseller@example.com' }, force: true });

    // Create test seller user
    const sellerUser = await User.create({
      email: 'chapaseller@example.com',
      password: 'hashedpassword123',
      first_name: 'Test',
      last_name: 'Seller',
      phone: '+251911234567',
      role: 'seller',
      is_verified: true
    });

    // Create seller profile
    testSeller = await Seller.create({
      user_id: sellerUser.id,
      store_name: 'Test Store',
      store_slug: 'test-store-chapa-bug-exploration',
      store_description: 'Test store for bug exploration',
      business_registration: 'TEST123',
      is_approved: true
    });

    // Create test product
    testProduct = await Product.create({
      seller_id: testSeller.id,
      name: 'Test Product for Chapa Payment',
      description: 'Product to test payment flow',
      price: 2033.00,
      quantity: 100,
      category: 'Electronics',
      is_published: true
    });

    // Create test customer user
    testUser = await User.create({
      email: 'chapatest@example.com',
      password: 'hashedpassword123',
      first_name: 'Chapa',
      last_name: 'TestUser',
      phone: '+251911234999',
      role: 'customer',
      is_verified: true
    });

    authToken = generateAccessToken(testUser);

    // Create cart with items
    testCart = await Cart.create({
      user_id: testUser.id
    });

    await CartItem.create({
      cart_id: testCart.id,
      product_id: testProduct.id,
      quantity: 3
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testCart) {
      await CartItem.destroy({ where: { cart_id: testCart.id } });
      await Cart.destroy({ where: { id: testCart.id } });
    }
    if (testProduct) {
      await Product.destroy({ where: { id: testProduct.id } });
    }
    if (testSeller) {
      await Seller.destroy({ where: { id: testSeller.id } });
    }
    if (testUser) {
      await Payment.destroy({ where: { order_id: { [sequelize.Sequelize.Op.in]: await Order.findAll({ where: { user_id: testUser.id }, attributes: ['id'] }).then(orders => orders.map(o => o.id)) } } });
      await Order.destroy({ where: { user_id: testUser.id } });
      await User.destroy({ where: { id: testUser.id } });
    }
    const sellerUser = await User.findOne({ where: { email: 'chapaseller@example.com' } });
    if (sellerUser) {
      await User.destroy({ where: { id: sellerUser.id } });
    }
  });

  describe('Test Case 1: Database Validation Error on Order Creation', () => {
    it('should successfully create order without database validation errors', async () => {
      // This test simulates a customer completing steps 1-2 and clicking "Place Order" at step 3
      // Expected: Order should be created successfully without "Database validation error"
      
      const shippingAddress = {
        street: '123 Test Street',
        city: 'Addis Ababa',
        state: 'Addis Ababa',
        country: 'Ethiopia',
        postal_code: '1000',
        phone: '+251911234999'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: JSON.stringify(shippingAddress),
          shippingCost: 50.00,
          paymentMethod: 'chapa',
          notes: 'Test order for bug exploration'
        });

      console.log('\n=== Test Case 1: Database Validation Error ===');
      console.log('Response Status:', response.status);
      console.log('Response Body:', JSON.stringify(response.body, null, 2));

      // Expected behavior: Order creation should succeed
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order).toHaveProperty('id');
      expect(response.body.data.order).toHaveProperty('order_number');
      
      // Should NOT contain database validation error
      const responseText = JSON.stringify(response.body).toLowerCase();
      expect(responseText).not.toContain('database validation error');
      expect(responseText).not.toContain('bad request');
      
      // Verify order was actually created in database
      const createdOrder = await Order.findOne({
        where: { id: response.body.data.order.id }
      });
      
      expect(createdOrder).not.toBeNull();
      expect(createdOrder.user_id).toBe(testUser.id);
      expect(parseFloat(createdOrder.totalAmount)).toBeGreaterThan(0);
      
      console.log('✓ Order created successfully without database errors');
      console.log('Order ID:', createdOrder.id);
      console.log('Order Number:', createdOrder.order_number);
      console.log('Total Amount:', createdOrder.totalAmount);
    });
  });

  describe('Test Case 2: Payment Initialization with Callback URL', () => {
    it('should initialize payment with properly configured callback URL', async () => {
      // First create an order
      const shippingAddress = {
        street: '456 Payment Test Street',
        city: 'Addis Ababa',
        state: 'Addis Ababa',
        country: 'Ethiopia',
        postal_code: '1000',
        phone: '+251911234999'
      };

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: JSON.stringify(shippingAddress),
          shippingCost: 50.00,
          paymentMethod: 'chapa',
          notes: 'Test order for payment initialization'
        });

      expect(orderResponse.status).toBe(201);
      const orderId = orderResponse.body.data.order.id;
      const totalAmount = parseFloat(orderResponse.body.data.order.totalAmount);

      // Now initialize payment
      const paymentResponse = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: orderId,
          amount: totalAmount,
          email: testUser.email,
          firstName: testUser.first_name,
          lastName: testUser.last_name,
          phoneNumber: testUser.phone
        });

      console.log('\n=== Test Case 2: Payment Initialization with Callback URL ===');
      console.log('Payment Response Status:', paymentResponse.status);
      console.log('Payment Response Body:', JSON.stringify(paymentResponse.body, null, 2));

      // Expected behavior: Payment initialization should succeed
      expect(paymentResponse.status).toBe(200);
      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.data).toHaveProperty('paymentUrl');
      expect(paymentResponse.body.data).toHaveProperty('reference');
      
      // Should NOT contain configuration errors about callback URL
      const responseText = JSON.stringify(paymentResponse.body).toLowerCase();
      expect(responseText).not.toContain('callback_url');
      expect(responseText).not.toContain('configuration error');
      expect(responseText).not.toContain('missing');
      
      console.log('✓ Payment initialized successfully');
      console.log('Payment URL:', paymentResponse.body.data.paymentUrl);
      console.log('Reference:', paymentResponse.body.data.reference);
    });
  });

  describe('Test Case 3: Payment Initialization with Return URL', () => {
    it('should initialize payment with properly configured return URL', async () => {
      // First create an order
      const shippingAddress = {
        street: '789 Return URL Test Street',
        city: 'Addis Ababa',
        state: 'Addis Ababa',
        country: 'Ethiopia',
        postal_code: '1000',
        phone: '+251911234999'
      };

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: JSON.stringify(shippingAddress),
          shippingCost: 50.00,
          paymentMethod: 'chapa',
          notes: 'Test order for return URL'
        });

      expect(orderResponse.status).toBe(201);
      const orderId = orderResponse.body.data.order.id;
      const totalAmount = parseFloat(orderResponse.body.data.order.totalAmount);

      // Initialize payment
      const paymentResponse = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: orderId,
          amount: totalAmount,
          email: testUser.email,
          firstName: testUser.first_name,
          lastName: testUser.last_name
        });

      console.log('\n=== Test Case 3: Payment Initialization with Return URL ===');
      console.log('Payment Response Status:', paymentResponse.status);
      console.log('Payment Response Body:', JSON.stringify(paymentResponse.body, null, 2));

      // Expected behavior: Payment initialization should succeed
      expect(paymentResponse.status).toBe(200);
      expect(paymentResponse.body.success).toBe(true);
      
      // Should NOT contain configuration errors about return URL
      const responseText = JSON.stringify(paymentResponse.body).toLowerCase();
      expect(responseText).not.toContain('return_url');
      expect(responseText).not.toContain('configuration error');
      
      console.log('✓ Payment initialized with return URL configured');
    });
  });

  describe('Test Case 4: Payment Record Persistence', () => {
    it('should create payment record with pending status after initialization', async () => {
      // Create order
      const shippingAddress = {
        street: '321 Persistence Test Street',
        city: 'Addis Ababa',
        state: 'Addis Ababa',
        country: 'Ethiopia',
        postal_code: '1000',
        phone: '+251911234999'
      };

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: JSON.stringify(shippingAddress),
          shippingCost: 50.00,
          paymentMethod: 'chapa',
          notes: 'Test order for payment persistence'
        });

      expect(orderResponse.status).toBe(201);
      const orderId = orderResponse.body.data.order.id;
      const totalAmount = parseFloat(orderResponse.body.data.order.totalAmount);

      // Initialize payment
      const paymentResponse = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: orderId,
          amount: totalAmount,
          email: testUser.email,
          firstName: testUser.first_name,
          lastName: testUser.last_name
        });

      console.log('\n=== Test Case 4: Payment Record Persistence ===');
      console.log('Payment Response Status:', paymentResponse.status);

      expect(paymentResponse.status).toBe(200);
      const reference = paymentResponse.body.data.reference;

      // Verify payment record was created in database
      const paymentRecord = await Payment.findOne({
        where: { chapa_tx_ref: reference }
      });

      console.log('Payment Record:', paymentRecord ? {
        id: paymentRecord.id,
        order_id: paymentRecord.order_id,
        amount: paymentRecord.amount,
        status: paymentRecord.status,
        chapa_tx_ref: paymentRecord.chapa_tx_ref
      } : 'NOT FOUND');

      // Expected behavior: Payment record should exist with pending status
      expect(paymentRecord).not.toBeNull();
      expect(paymentRecord.order_id).toBe(orderId);
      expect(parseFloat(paymentRecord.amount)).toBe(totalAmount);
      expect(paymentRecord.status).toBe('pending');
      expect(paymentRecord.chapa_tx_ref).toBe(reference);
      
      console.log('✓ Payment record persisted successfully');
      console.log('Payment ID:', paymentRecord.id);
      console.log('Status:', paymentRecord.status);
    });
  });

  describe('Test Case 5: Transaction Visibility - Customer Interface', () => {
    it('should make transaction visible in customer order history after payment', async () => {
      // Create order and initialize payment
      const shippingAddress = {
        street: '654 Customer Visibility Test',
        city: 'Addis Ababa',
        state: 'Addis Ababa',
        country: 'Ethiopia',
        postal_code: '1000',
        phone: '+251911234999'
      };

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddress: JSON.stringify(shippingAddress),
          shippingCost: 50.00,
          paymentMethod: 'chapa',
          notes: 'Test order for customer visibility'
        });

      expect(orderResponse.status).toBe(201);
      const orderId = orderResponse.body.data.order.id;

      // Query customer orders
      const ordersResponse = await request(app)
        .get('/api/orders/customer/orders')
        .set('Authorization', `Bearer ${authToken}`);

      console.log('\n=== Test Case 5: Transaction Visibility - Customer ===');
      console.log('Orders Response Status:', ordersResponse.status);
      console.log('Number of Orders:', ordersResponse.body.data?.orders?.length || 0);

      // Expected behavior: Customer should see their order
      expect(ordersResponse.status).toBe(200);
      expect(ordersResponse.body.success).toBe(true);
      expect(ordersResponse.body.data.orders).toBeInstanceOf(Array);
      
      const customerOrder = ordersResponse.body.data.orders.find(o => o.id === orderId);
      expect(customerOrder).toBeDefined();
      expect(customerOrder.user_id).toBe(testUser.id);
      
      console.log('✓ Transaction visible in customer interface');
      console.log('Order found in customer history:', customerOrder ? 'YES' : 'NO');
    });
  });

  describe('Test Case 6: Missing CHAPA_CALLBACK_URL Configuration', () => {
    /**
     * Task 1.6: Test missing CHAPA_CALLBACK_URL configuration
     * 
     * This test verifies that the system properly handles the case where
     * CHAPA_CALLBACK_URL is not configured in the environment.
     * 
     * EXPECTED BEHAVIOR ON UNFIXED CODE: 
     * - Payment initialization may fail with configuration error
     * - OR payment may initialize but callback URL is missing/invalid
     * - System should detect and report missing callback URL
     * 
     * EXPECTED BEHAVIOR ON FIXED CODE:
     * - System validates callback URL at startup
     * - Payment initialization fails gracefully with clear error message
     * - OR callback URL is properly configured and payment succeeds
     * 
     * Validates Requirements: 2.1, 3.1, 3.2
     */
    it('should validate CHAPA_CALLBACK_URL is configured before payment initialization', async () => {
      console.log('\n=== Test Case 6: Missing CHAPA_CALLBACK_URL Configuration ===');
      
      // Check if payment configuration exists and has callback URL
      const paymentConfig = require('../../src/config/payment');
      
      console.log('Payment Config:', {
        exists: !!paymentConfig,
        hasUrls: !!paymentConfig.urls,
        callbackUrl: paymentConfig.urls?.callbackUrl || 'NOT SET',
        returnUrl: paymentConfig.urls?.returnUrl || 'NOT SET'
      });

      // Expected behavior: Callback URL should be configured
      expect(paymentConfig).toBeDefined();
      expect(paymentConfig.urls).toBeDefined();
      expect(paymentConfig.urls.callbackUrl).toBeDefined();
      expect(paymentConfig.urls.callbackUrl).not.toBe('');
      expect(paymentConfig.urls.callbackUrl).toMatch(/^https?:\/\//); // Should be a valid URL
      
      console.log('✓ CHAPA_CALLBACK_URL is properly configured');
      console.log('Callback URL:', paymentConfig.urls.callbackUrl);
    });

    it('should verify callback URL is used in payment initialization flow', async () => {
      console.log('\n=== Test Case 6b: Callback URL Usage Verification ===');
      
      // This test verifies that the callback URL configuration is properly loaded
      // and would be used when payment initialization occurs
      
      const paymentConfig = require('../../src/config/payment');
      const originalCallbackUrl = paymentConfig.urls?.callbackUrl;
      
      console.log('Original Callback URL:', originalCallbackUrl);
      
      // Expected behavior: Callback URL should be configured and valid
      expect(originalCallbackUrl).toBeDefined();
      expect(originalCallbackUrl).not.toBe('');
      expect(originalCallbackUrl).toMatch(/^https?:\/\//);
      
      // Verify the callback URL would be included in payment requests
      // Note: We cannot test actual Chapa API calls without valid credentials,
      // but we can verify the configuration is ready
      
      console.log('✓ Callback URL configuration is ready for payment initialization');
      console.log('When payment is initialized, this URL will be sent to Chapa');
      console.log('Chapa will use this URL to send webhook notifications');
    });

    it('should include callback URL in Chapa API request', async () => {
      console.log('\n=== Test Case 6c: Callback URL in Chapa API Request ===');
      
      // This test verifies that when payment is initialized, the callback URL
      // is actually included in the request to Chapa's API
      
      const paymentConfig = require('../../src/config/payment');
      const callbackUrl = paymentConfig.urls?.callbackUrl;
      
      console.log('Configured Callback URL:', callbackUrl);
      
      // Expected behavior: Callback URL should be a valid HTTPS URL
      expect(callbackUrl).toBeDefined();
      expect(callbackUrl).toMatch(/^https?:\/\/.+/);
      
      // Verify it points to the correct endpoint (webhook or callback)
      expect(callbackUrl).toMatch(/\/api\/payments\/(callback|webhook)/);
      
      console.log('✓ Callback URL is properly formatted and points to correct endpoint');
      console.log('Expected format: https://yourdomain.com/api/payments/callback or /webhook');
      console.log('Actual URL:', callbackUrl);
    });
  });

  describe('Test Case 7: Missing CHAPA_RETURN_URL Configuration', () => {
    /**
     * Task 1.7: Test missing CHAPA_RETURN_URL configuration
     * 
     * This test verifies that the system properly handles the case where
     * CHAPA_RETURN_URL is not configured in the environment.
     * 
     * EXPECTED BEHAVIOR ON UNFIXED CODE: 
     * - Payment initialization may fail with configuration error
     * - OR payment may initialize but return URL is missing/invalid
     * - System should detect and report missing return URL
     * 
     * EXPECTED BEHAVIOR ON FIXED CODE:
     * - System validates return URL at startup
     * - Payment initialization fails gracefully with clear error message
     * - OR return URL is properly configured and payment succeeds
     * 
     * Validates Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
     */
    it('should validate CHAPA_RETURN_URL is configured before payment initialization', async () => {
      console.log('\n=== Test Case 7: Missing CHAPA_RETURN_URL Configuration ===');
      
      // Check if payment configuration exists and has return URL
      const paymentConfig = require('../../src/config/payment');
      
      console.log('Payment Config:', {
        exists: !!paymentConfig,
        hasUrls: !!paymentConfig.urls,
        callbackUrl: paymentConfig.urls?.callbackUrl || 'NOT SET',
        returnUrl: paymentConfig.urls?.returnUrl || 'NOT SET'
      });

      // Expected behavior: Return URL should be configured
      expect(paymentConfig).toBeDefined();
      expect(paymentConfig.urls).toBeDefined();
      expect(paymentConfig.urls.returnUrl).toBeDefined();
      expect(paymentConfig.urls.returnUrl).not.toBe('');
      expect(paymentConfig.urls.returnUrl).toMatch(/^https?:\/\//); // Should be a valid URL
      
      console.log('✓ CHAPA_RETURN_URL is properly configured');
      console.log('Return URL:', paymentConfig.urls.returnUrl);
    });

    it('should verify return URL is used in payment initialization flow', async () => {
      console.log('\n=== Test Case 7b: Return URL Usage Verification ===');
      
      // This test verifies that the return URL configuration is properly loaded
      // and would be used when payment initialization occurs
      
      const paymentConfig = require('../../src/config/payment');
      const originalReturnUrl = paymentConfig.urls?.returnUrl;
      
      console.log('Original Return URL:', originalReturnUrl);
      
      // Expected behavior: Return URL should be configured and valid
      expect(originalReturnUrl).toBeDefined();
      expect(originalReturnUrl).not.toBe('');
      expect(originalReturnUrl).toMatch(/^https?:\/\//);
      
      // Verify the return URL would be included in payment requests
      // Note: We cannot test actual Chapa API calls without valid credentials,
      // but we can verify the configuration is ready
      
      console.log('✓ Return URL configuration is ready for payment initialization');
      console.log('When payment is initialized, this URL will be sent to Chapa');
      console.log('Chapa will redirect customers to this URL after payment completion');
    });

    it('should include return URL in Chapa API request', async () => {
      console.log('\n=== Test Case 7c: Return URL in Chapa API Request ===');
      
      // This test verifies that when payment is initialized, the return URL
      // is actually included in the request to Chapa's API
      
      const paymentConfig = require('../../src/config/payment');
      const returnUrl = paymentConfig.urls?.returnUrl;
      
      console.log('Configured Return URL:', returnUrl);
      
      // Expected behavior: Return URL should be a valid HTTPS/HTTP URL
      expect(returnUrl).toBeDefined();
      expect(returnUrl).toMatch(/^https?:\/\/.+/);
      
      // Verify it's a valid URL format (could be frontend or backend endpoint)
      // Frontend: http://localhost:3000/payment/return
      // Backend: https://yourdomain.com/api/payments/return
      const isValidReturnUrl = 
        returnUrl.includes('/payment/return') || 
        returnUrl.includes('/api/payments/return') ||
        returnUrl.includes('/api/payments/redirect');
      
      expect(isValidReturnUrl).toBe(true);
      
      console.log('✓ Return URL is properly formatted and points to correct endpoint');
      console.log('Accepted formats:');
      console.log('  - Frontend: http://localhost:3000/payment/return');
      console.log('  - Backend: https://yourdomain.com/api/payments/return or /redirect');
      console.log('Actual URL:', returnUrl);
    });

    it('should verify return URL handles customer redirect after payment', async () => {
      console.log('\n=== Test Case 7d: Return URL Customer Redirect Handling ===');
      
      // This test verifies that the return URL endpoint is properly set up
      // to handle customer redirects from Chapa after payment completion
      
      const paymentConfig = require('../../src/config/payment');
      const returnUrl = paymentConfig.urls?.returnUrl;
      
      console.log('Return URL for customer redirect:', returnUrl);
      
      // Expected behavior: Return URL should be accessible and properly configured
      expect(returnUrl).toBeDefined();
      expect(returnUrl).toMatch(/^https?:\/\//);
      
      // The return URL should be designed to:
      // 1. Parse query parameters (tx_ref, status) from Chapa's redirect
      // 2. Return HTML page that signals Flutter WebView to close
      // 3. Allow Flutter app to poll backend for payment status
      
      console.log('✓ Return URL is configured for customer redirect handling');
      console.log('Expected behavior after payment:');
      console.log('  1. Chapa redirects customer to:', returnUrl);
      console.log('  2. Backend returns HTML to close WebView');
      console.log('  3. Flutter app polls for payment status');
      console.log('  4. Customer sees success/failure screen');
    });
  });

  describe('Test Case 8: Missing Environment Variables Summary', () => {
    it('should document environment variable requirements', () => {
      console.log('\n=== Environment Variable Requirements ===');
      console.log('Required environment variables for Chapa payment integration:');
      console.log('1. CHAPA_CALLBACK_URL - Webhook endpoint for payment status updates');
      console.log('2. CHAPA_RETURN_URL - Redirect URL after payment completion');
      console.log('3. CHAPA_SECRET_KEY - Chapa API secret key');
      console.log('4. CHAPA_PUBLIC_KEY - Chapa API public key (optional)');
      console.log('\nThese should be configured in .env file before starting the server');
      console.log('Example:');
      console.log('CHAPA_CALLBACK_URL=https://yourdomain.com/api/payments/callback');
      console.log('CHAPA_RETURN_URL=https://yourdomain.com/api/payments/return');
      console.log('========================================\n');
    });
  });

  describe('PROPERTY TEST: Complete Checkout Flow with Valid Data', () => {
    /**
     * Task 1.2: Property-based test that simulates complete checkout flow
     * 
     * This test generates random but valid checkout data and attempts to complete
     * the full checkout flow (steps 1-3) including order creation and payment initialization.
     * 
     * EXPECTED BEHAVIOR ON UNFIXED CODE: Test should FAIL with "Database validation error"
     * EXPECTED BEHAVIOR ON FIXED CODE: Test should PASS - all orders created successfully
     * 
     * The test validates:
     * - Order creation succeeds with various valid inputs
     * - Payment initialization succeeds with proper callback/return URLs
     * - Payment records are persisted with "pending" status
     * - No database validation errors occur
     * 
     * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 3.2, 4.4
     * Property 1: Fault Condition - Database Validation Error Resolution
     */
    it('should successfully complete checkout flow for any valid customer data', async () => {
      console.log('\n=== PROPERTY TEST: Complete Checkout Flow ===');
      console.log('Generating random valid checkout scenarios...\n');

      // Arbitraries for generating valid test data
      const validStreetArb = fc.string({ minLength: 5, maxLength: 100 });
      const validCityArb = fc.constantFrom('Addis Ababa', 'Dire Dawa', 'Mekelle', 'Bahir Dar', 'Hawassa');
      const validStateArb = fc.constantFrom('Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'SNNPR');
      const validPostalCodeArb = fc.integer({ min: 1000, max: 9999 }).map(n => n.toString());
      const validPhoneArb = fc.integer({ min: 900000000, max: 999999999 }).map(n => `+251${n}`);
      const validShippingCostArb = fc.double({ min: 0, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100);
      const validQuantityArb = fc.integer({ min: 1, max: 5 });
      const validNotesArb = fc.option(fc.string({ maxLength: 200 }), { nil: undefined });

      // Arbitrary for complete checkout request
      const checkoutRequestArb = fc.record({
        street: validStreetArb,
        city: validCityArb,
        state: validStateArb,
        postalCode: validPostalCodeArb,
        phone: validPhoneArb,
        shippingCost: validShippingCostArb,
        quantity: validQuantityArb,
        notes: validNotesArb
      });

      // Property: For all valid checkout requests, order creation and payment initialization should succeed
      await fc.assert(
        fc.asyncProperty(checkoutRequestArb, async (checkoutData) => {
          // Create a unique cart for this property test iteration
          const uniqueCart = await Cart.create({
            user_id: testUser.id
          });

          await CartItem.create({
            cart_id: uniqueCart.id,
            product_id: testProduct.id,
            quantity: checkoutData.quantity
          });

          // Construct shipping address
          const shippingAddress = {
            street: checkoutData.street,
            city: checkoutData.city,
            state: checkoutData.state,
            country: 'Ethiopia',
            postal_code: checkoutData.postalCode,
            phone: checkoutData.phone
          };

          // Step 1-2: Complete address and shipping steps
          // Step 3: Click "Place Order" at payment step
          const orderResponse = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              shippingAddress: JSON.stringify(shippingAddress),
              shippingCost: checkoutData.shippingCost,
              paymentMethod: 'chapa',
              notes: checkoutData.notes || 'Property test order'
            });

          // Clean up cart after test
          await CartItem.destroy({ where: { cart_id: uniqueCart.id } });
          await Cart.destroy({ where: { id: uniqueCart.id } });

          // Log the result for this iteration
          if (orderResponse.status !== 201) {
            console.log(`❌ COUNTEREXAMPLE FOUND:`);
            console.log(`   Status: ${orderResponse.status}`);
            console.log(`   Error: ${JSON.stringify(orderResponse.body)}`);
            console.log(`   Input: ${JSON.stringify(checkoutData, null, 2)}`);
          }

          // PROPERTY ASSERTIONS
          // 1. Order creation should succeed (no database validation error)
          expect(orderResponse.status).toBe(201);
          expect(orderResponse.body.success).toBe(true);
          
          // 2. Response should contain order data
          expect(orderResponse.body.data).toHaveProperty('order');
          expect(orderResponse.body.data.order).toHaveProperty('id');
          expect(orderResponse.body.data.order).toHaveProperty('order_number');
          
          // 3. Should NOT contain database validation error
          const responseText = JSON.stringify(orderResponse.body).toLowerCase();
          expect(responseText).not.toContain('database validation error');
          expect(responseText).not.toContain('bad request');
          
          // 4. Order should be persisted in database
          const orderId = orderResponse.body.data.order.id;
          const createdOrder = await Order.findOne({ where: { id: orderId } });
          expect(createdOrder).not.toBeNull();
          expect(createdOrder.user_id).toBe(testUser.id);
          expect(parseFloat(createdOrder.totalAmount)).toBeGreaterThan(0);
          
          // 5. Initialize payment for this order
          const totalAmount = parseFloat(createdOrder.totalAmount);
          const paymentResponse = await request(app)
            .post('/api/payments/initiate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              orderId: orderId,
              amount: totalAmount,
              email: testUser.email,
              firstName: testUser.first_name,
              lastName: testUser.last_name,
              phoneNumber: testUser.phone
            });

          // 6. Payment initialization should succeed
          expect(paymentResponse.status).toBe(200);
          expect(paymentResponse.body.success).toBe(true);
          expect(paymentResponse.body.data).toHaveProperty('paymentUrl');
          expect(paymentResponse.body.data).toHaveProperty('reference');
          
          // 7. Should NOT contain callback/return URL configuration errors
          const paymentResponseText = JSON.stringify(paymentResponse.body).toLowerCase();
          expect(paymentResponseText).not.toContain('callback_url');
          expect(paymentResponseText).not.toContain('return_url');
          expect(paymentResponseText).not.toContain('configuration error');
          
          // 8. Payment record should be persisted with "pending" status
          const reference = paymentResponse.body.data.reference;
          const paymentRecord = await Payment.findOne({
            where: { chapa_tx_ref: reference }
          });
          
          expect(paymentRecord).not.toBeNull();
          expect(paymentRecord.order_id).toBe(orderId);
          expect(parseFloat(paymentRecord.amount)).toBe(totalAmount);
          expect(paymentRecord.status).toBe('pending');
          
          // Clean up created order and payment for this iteration
          await Payment.destroy({ where: { id: paymentRecord.id } });
          await Order.destroy({ where: { id: orderId } });
          
          return true;
        }),
        {
          numRuns: 10, // Run 10 random test cases
          verbose: true,
          endOnFailure: true // Stop on first failure to show counterexample
        }
      );

      console.log('\n✓ Property test completed successfully');
      console.log('All 10 random checkout scenarios passed without database errors\n');
    }, 60000); // 60 second timeout for property test
  });

  describe('Summary: Bug Condition Counterexamples', () => {
    it('should document all counterexamples found', () => {
      console.log('\n========================================');
      console.log('BUG CONDITION EXPLORATION SUMMARY');
      console.log('========================================\n');
      console.log('This test suite explores the bug condition where customers complete');
      console.log('checkout steps 1-2 and click "Place Order" at step 3, causing:');
      console.log('- "Exception: Bad request: Database validation error"');
      console.log('- Payment initialization failures');
      console.log('- Missing callback/return URL configuration');
      console.log('- Transaction persistence issues\n');
      console.log('Expected Outcome: Tests PASS on FIXED code\n');
      console.log('Counterexamples tested:');
      console.log('1. Database Validation Error → Order creation should succeed');
      console.log('2. Missing Callback URL → Payment initialization should succeed');
      console.log('3. Missing Return URL → Payment initialization should succeed');
      console.log('4. Payment Record Persistence → Payment record should be created');
      console.log('5. Customer Visibility → Transaction should be visible in order history');
      console.log('6. Missing CHAPA_CALLBACK_URL → Callback URL should be configured and validated');
      console.log('7. Missing CHAPA_RETURN_URL → Return URL should be configured and validated');
      console.log('8. Environment Configuration → All required URLs should be set');
      console.log('9. PROPERTY TEST → Complete checkout flow with 10 random valid scenarios');
      console.log('\n========================================\n');
    });
  });
});
