/**
 * Integration Test: Payment Retry After Transient Failures
 * 
 * This test validates the payment retry mechanism when transient failures occur:
 * 1. Network errors trigger retry with exponential backoff
 * 2. Chapa 5xx errors are retried up to 3 times
 * 3. Chapa 4xx errors are NOT retried (permanent failures)
 * 4. Successful retry after transient failure completes the payment flow
 * 5. All retries exhausted results in proper error handling
 * 
 * Validates Requirements: 3.10, 3.11, 3.12
 * Validates Design: Retry logic for network errors, exponential backoff, 5xx vs 4xx handling
 * 
 * Task 18.7: Test payment retry after transient failures
 */

const request = require('supertest');
const app = require('../../src/server');
const { Order, OrderItem, Cart, CartItem, Product, Seller, User, Payment, sequelize } = require('../../src/models');
const { generateAccessToken } = require('../../src/utils/tokenUtils');
const chapaService = require('../../src/services/chapaService');
const axios = require('axios');

// Mock axios to simulate network errors and API responses
jest.mock('axios');

describe('Integration Test: Payment Retry After Transient Failures', () => {
  let customerToken;
  let testCustomer;
  let testSeller;
  let testSellerUser;
  let testProduct;
  let testCart;
  let testOrder;

  beforeAll(async () => {
    // Clean up any existing test data
    await User.destroy({ where: { email: 'retry-customer@test.com' }, force: true });
    await User.destroy({ where: { email: 'retry-seller@test.com' }, force: true });

    // Create test seller user
    testSellerUser = await User.create({
      email: 'retry-seller@test.com',
      password: 'hashedpassword123',
      first_name: 'Retry',
      last_name: 'Seller',
      phone: '+251911111111',
      role: 'seller',
      is_verified: true
    });

    // Create seller profile
    testSeller = await Seller.create({
      user_id: testSellerUser.id,
      store_name: 'Retry Test Store',
      store_slug: 'retry-test-store',
      store_description: 'Test store for retry testing',
      business_registration: 'RETRY123',
      is_approved: true
    });

    // Create test product
    testProduct = await Product.create({
      seller_id: testSeller.id,
      name: 'Retry Test Product',
      description: 'Product for testing payment retry',
      price: 2500.00,
      quantity: 50,
      category: 'Electronics',
      is_published: true
    });

    // Create test customer user
    testCustomer = await User.create({
      email: 'retry-customer@test.com',
      password: 'hashedpassword123',
      first_name: 'Retry',
      last_name: 'Customer',
      phone: '+251922222222',
      role: 'customer',
      is_verified: true
    });

    // Generate auth token
    customerToken = generateAccessToken(testCustomer);

    // Create cart with items
    testCart = await Cart.create({
      user_id: testCustomer.id
    });

    await CartItem.create({
      cart_id: testCart.id,
      product_id: testProduct.id,
      quantity: 2
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testCart) {
      await CartItem.destroy({ where: { cart_id: testCart.id } });
      await Cart.destroy({ where: { id: testCart.id } });
    }
    if (testOrder) {
      await OrderItem.destroy({ where: { order_id: testOrder.id } });
      await Payment.destroy({ where: { order_id: testOrder.id } });
      await Order.destroy({ where: { id: testOrder.id } });
    }
    if (testProduct) await Product.destroy({ where: { id: testProduct.id } });
    if (testSeller) await Seller.destroy({ where: { id: testSeller.id } });
    if (testSellerUser) await User.destroy({ where: { id: testSellerUser.id } });
    if (testCustomer) await User.destroy({ where: { id: testCustomer.id } });

    // Reset circuit breaker
    chapaService.chapaCircuitBreaker.reset();
  });

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    // Reset circuit breaker state
    chapaService.chapaCircuitBreaker.reset();
    
    // Ensure cart has items before each test
    const existingCartItems = await CartItem.findAll({ where: { cart_id: testCart.id } });
    if (existingCartItems.length === 0) {
      await CartItem.create({
        cart_id: testCart.id,
        product_id: testProduct.id,
        quantity: 2
      });
    }
  });

  afterEach(async () => {
    // Clean up any orders created during the test
    const orders = await Order.findAll({ where: { user_id: testCustomer.id } });
    for (const order of orders) {
      await OrderItem.destroy({ where: { order_id: order.id } });
      await Payment.destroy({ where: { order_id: order.id } });
      await Order.destroy({ where: { id: order.id } });
    }
    
    // Restore product stock
    await testProduct.update({ quantity: 50 });
    
    // Restore cart items
    await CartItem.destroy({ where: { cart_id: testCart.id } });
    await CartItem.create({
      cart_id: testCart.id,
      product_id: testProduct.id,
      quantity: 2
    });
  });

  describe('Network Error Retry with Exponential Backoff', () => {
    it('should retry payment initialization on network errors with exponential backoff', async () => {
      // Mock axios to fail twice with network error, then succeed
      let attemptCount = 0;
      axios.post.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          // Simulate network error (ECONNREFUSED)
          const error = new Error('connect ECONNREFUSED');
          error.code = 'ECONNREFUSED';
          return Promise.reject(error);
        }
        // Third attempt succeeds
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: {
            status: 'success',
            message: 'Payment initialized',
            data: {
              checkout_url: 'https://checkout.chapa.co/test-checkout-url',
              tx_ref: `order-test-${Date.now()}`
            }
          }
        });
      });

      // Create order (which triggers payment initialization)
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            full_name: 'Retry Customer',
            phone: '+251922222222',
            street_address: '123 Test St',
            city: 'Addis Ababa',
            country: 'Ethiopia'
          },
          shippingCost: 50,
          paymentMethod: 'mobile_money',
          notes: 'Test order for network retry'
        });

      // Verify order was created successfully after retries
      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.success).toBe(true);
      expect(orderResponse.body.data.order).toBeDefined();
      expect(orderResponse.body.data.paymentUrl).toBeDefined();

      // Verify axios was called 3 times (2 failures + 1 success)
      expect(axios.post).toHaveBeenCalledTimes(3);

      // Store order for cleanup
      testOrder = orderResponse.body.data.order;

      // Verify payment record was created with pending status
      const payment = await Payment.findOne({ where: { order_id: testOrder.id } });
      expect(payment).toBeDefined();
      expect(payment.status).toBe('pending');
      expect(payment.chapa_tx_ref).toBeDefined();
    }, 30000); // Increase timeout for retry delays

    it('should use exponential backoff delays (1s, 2s, 4s) between retries', async () => {
      const delays = [];
      let lastCallTime = Date.now();

      // Mock axios to track timing between calls
      axios.post.mockImplementation(() => {
        const currentTime = Date.now();
        if (delays.length > 0) {
          delays.push(currentTime - lastCallTime);
        }
        lastCallTime = currentTime;

        if (delays.length < 2) {
          const error = new Error('connect ETIMEDOUT');
          error.code = 'ETIMEDOUT';
          return Promise.reject(error);
        }

        return Promise.resolve({
          status: 200,
          data: {
            status: 'success',
            data: {
              checkout_url: 'https://checkout.chapa.co/test',
              tx_ref: `order-test-${Date.now()}`
            }
          }
        });
      });

      // Create order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            full_name: 'Retry Customer',
            phone: '+251922222222',
            street_address: '123 Test St',
            city: 'Addis Ababa',
            country: 'Ethiopia'
          },
          shippingCost: 50,
          paymentMethod: 'mobile_money'
        });

      expect(orderResponse.status).toBe(201);

      // Verify exponential backoff delays (approximately 1s, 2s)
      // Allow 500ms tolerance for execution time
      expect(delays[0]).toBeGreaterThanOrEqual(900); // ~1s
      expect(delays[0]).toBeLessThan(1500);
      expect(delays[1]).toBeGreaterThanOrEqual(1900); // ~2s
      expect(delays[1]).toBeLessThan(2500);

      testOrder = orderResponse.body.data.order;
    }, 30000);
  });

  describe('5xx Server Error Retry', () => {
    it('should retry payment initialization on Chapa 5xx errors up to 3 times', async () => {
      let attemptCount = 0;
      axios.post.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          // Simulate 503 Service Unavailable
          const error = new Error('Request failed with status code 503');
          error.response = {
            status: 503,
            statusText: 'Service Unavailable',
            data: { message: 'Service temporarily unavailable' },
            headers: { 'content-type': 'application/json' }
          };
          return Promise.reject(error);
        }
        // Third attempt succeeds
        return Promise.resolve({
          status: 200,
          data: {
            status: 'success',
            data: {
              checkout_url: 'https://checkout.chapa.co/test',
              tx_ref: `order-test-${Date.now()}`
            }
          }
        });
      });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            full_name: 'Retry Customer',
            phone: '+251922222222',
            street_address: '123 Test St',
            city: 'Addis Ababa',
            country: 'Ethiopia'
          },
          shippingCost: 50,
          paymentMethod: 'mobile_money'
        });

      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.success).toBe(true);
      expect(axios.post).toHaveBeenCalledTimes(3);

      testOrder = orderResponse.body.data.order;
    }, 30000);

    it('should treat 500, 502, 503, 504 errors as retryable', async () => {
      const serverErrors = [500, 502, 503, 504];
      
      for (const errorCode of serverErrors) {
        jest.clearAllMocks();
        chapaService.chapaCircuitBreaker.reset();

        let attemptCount = 0;
        axios.post.mockImplementation(() => {
          attemptCount++;
          if (attemptCount === 1) {
            const error = new Error(`Request failed with status code ${errorCode}`);
            error.response = {
              status: errorCode,
              statusText: 'Server Error',
              data: { message: 'Server error' },
              headers: { 'content-type': 'application/json' }
            };
            return Promise.reject(error);
          }
          return Promise.resolve({
            status: 200,
            data: {
              status: 'success',
              data: {
                checkout_url: 'https://checkout.chapa.co/test',
                tx_ref: `order-test-${Date.now()}`
              }
            }
          });
        });

        const orderResponse = await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            shippingAddress: {
              full_name: 'Retry Customer',
              phone: '+251922222222',
              street_address: '123 Test St',
              city: 'Addis Ababa',
              country: 'Ethiopia'
            },
            shippingCost: 50,
            paymentMethod: 'mobile_money'
          });

        expect(orderResponse.status).toBe(201);
        expect(axios.post).toHaveBeenCalledTimes(2); // 1 failure + 1 success

        // Clean up order
        if (orderResponse.body.data.order) {
          const orderId = orderResponse.body.data.order.id;
          await OrderItem.destroy({ where: { order_id: orderId } });
          await Payment.destroy({ where: { order_id: orderId } });
          await Order.destroy({ where: { id: orderId } });
        }
      }
    }, 60000);
  });

  describe('4xx Client Error - No Retry', () => {
    it('should NOT retry payment initialization on Chapa 4xx errors', async () => {
      // Mock axios to return 400 Bad Request
      axios.post.mockImplementation(() => {
        const error = new Error('Request failed with status code 400');
        error.response = {
          status: 400,
          statusText: 'Bad Request',
          data: { message: 'Invalid request parameters' },
          headers: { 'content-type': 'application/json' }
        };
        return Promise.reject(error);
      });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            full_name: 'Retry Customer',
            phone: '+251922222222',
            street_address: '123 Test St',
            city: 'Addis Ababa',
            country: 'Ethiopia'
          },
          shippingCost: 50,
          paymentMethod: 'mobile_money'
        });

      // Order creation should fail without retries
      expect(orderResponse.status).toBe(400);
      expect(orderResponse.body.success).toBe(false);
      expect(orderResponse.body.message).toContain('Payment initialization failed');

      // Verify axios was called only once (no retries)
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 401, 403, 404, 422 errors', async () => {
      const clientErrors = [401, 403, 404, 422];
      
      for (const errorCode of clientErrors) {
        jest.clearAllMocks();
        chapaService.chapaCircuitBreaker.reset();

        axios.post.mockImplementation(() => {
          const error = new Error(`Request failed with status code ${errorCode}`);
          error.response = {
            status: errorCode,
            statusText: 'Client Error',
            data: { message: 'Client error' },
            headers: { 'content-type': 'application/json' }
          };
          return Promise.reject(error);
        });

        const orderResponse = await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            shippingAddress: {
              full_name: 'Retry Customer',
              phone: '+251922222222',
              street_address: '123 Test St',
              city: 'Addis Ababa',
              country: 'Ethiopia'
            },
            shippingCost: 50,
            paymentMethod: 'mobile_money'
          });

        expect(orderResponse.status).toBe(400);
        expect(axios.post).toHaveBeenCalledTimes(1); // No retries
      }
    });
  });

  describe('All Retries Exhausted', () => {
    it('should fail gracefully when all 3 retry attempts are exhausted', async () => {
      // Mock axios to always fail with network error
      axios.post.mockImplementation(() => {
        const error = new Error('connect ECONNREFUSED');
        error.code = 'ECONNREFUSED';
        return Promise.reject(error);
      });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            full_name: 'Retry Customer',
            phone: '+251922222222',
            street_address: '123 Test St',
            city: 'Addis Ababa',
            country: 'Ethiopia'
          },
          shippingCost: 50,
          paymentMethod: 'mobile_money'
        });

      // Order creation should fail after all retries
      expect(orderResponse.status).toBe(400);
      expect(orderResponse.body.success).toBe(false);
      expect(orderResponse.body.message).toContain('Payment initialization failed');

      // Verify axios was called 3 times (max retries)
      expect(axios.post).toHaveBeenCalledTimes(3);

      // Verify no order was created (transaction rolled back)
      const orders = await Order.findAll({ where: { user_id: testCustomer.id } });
      expect(orders.length).toBe(0);
    }, 30000);

    it('should provide clear error message when retries are exhausted', async () => {
      axios.post.mockImplementation(() => {
        const error = new Error('Request failed with status code 503');
        error.response = {
          status: 503,
          statusText: 'Service Unavailable',
          data: { message: 'Service temporarily unavailable' },
          headers: { 'content-type': 'application/json' }
        };
        return Promise.reject(error);
      });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            full_name: 'Retry Customer',
            phone: '+251922222222',
            street_address: '123 Test St',
            city: 'Addis Ababa',
            country: 'Ethiopia'
          },
          shippingCost: 50,
          paymentMethod: 'mobile_money'
        });

      expect(orderResponse.status).toBe(400);
      expect(orderResponse.body.success).toBe(false);
      expect(orderResponse.body.message).toBe('Payment initialization failed. Please try again.');
      expect(orderResponse.body.error).toBeDefined();
    }, 30000);
  });

  describe('Successful Retry Completes Payment Flow', () => {
    it('should complete full payment flow after successful retry', async () => {
      // Mock axios to fail once, then succeed
      let attemptCount = 0;
      const txRef = `order-test-${Date.now()}`;
      
      axios.post.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('connect ETIMEDOUT');
          error.code = 'ETIMEDOUT';
          return Promise.reject(error);
        }
        return Promise.resolve({
          status: 200,
          data: {
            status: 'success',
            data: {
              checkout_url: 'https://checkout.chapa.co/test-checkout',
              tx_ref: txRef
            }
          }
        });
      });

      // Create order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            full_name: 'Retry Customer',
            phone: '+251922222222',
            street_address: '123 Test St',
            city: 'Addis Ababa',
            country: 'Ethiopia'
          },
          shippingCost: 50,
          paymentMethod: 'mobile_money'
        });

      // Verify order created successfully
      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.success).toBe(true);
      expect(orderResponse.body.data.order).toBeDefined();
      expect(orderResponse.body.data.paymentUrl).toBe('https://checkout.chapa.co/test-checkout');
      expect(orderResponse.body.data.txRef).toBe(txRef);

      testOrder = orderResponse.body.data.order;

      // Verify order details
      expect(testOrder.payment_status).toBe('pending');
      expect(testOrder.order_status).toBe('pending');
      expect(testOrder.total_amount).toBe('5050.00'); // 2500 * 2 + 50 shipping

      // Verify payment record
      const payment = await Payment.findOne({ where: { order_id: testOrder.id } });
      expect(payment).toBeDefined();
      expect(payment.status).toBe('pending');
      expect(payment.chapa_tx_ref).toBe(txRef);
      expect(payment.amount).toBe('5050.00');
      expect(payment.currency).toBe('ETB');

      // Verify order items
      const orderItems = await OrderItem.findAll({ where: { order_id: testOrder.id } });
      expect(orderItems.length).toBe(1);
      expect(orderItems[0].product_id).toBe(testProduct.id);
      expect(orderItems[0].quantity).toBe(2);

      // Verify product stock was decremented
      const updatedProduct = await Product.findByPk(testProduct.id);
      expect(updatedProduct.quantity).toBe(48); // 50 - 2

      // Verify cart was cleared
      const cartItems = await CartItem.findAll({ where: { cart_id: testCart.id } });
      expect(cartItems.length).toBe(0);
    }, 30000);
  });

  describe('Payment Verification Retry', () => {
    it('should retry payment verification on network errors', async () => {
      // First create an order with payment
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          status: 'success',
          data: {
            checkout_url: 'https://checkout.chapa.co/test',
            tx_ref: `order-test-${Date.now()}`
          }
        }
      });

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            full_name: 'Retry Customer',
            phone: '+251922222222',
            street_address: '123 Test St',
            city: 'Addis Ababa',
            country: 'Ethiopia'
          },
          shippingCost: 50,
          paymentMethod: 'mobile_money'
        });

      expect(orderResponse.status).toBe(201);
      testOrder = orderResponse.body.data.order;
      const txRef = orderResponse.body.data.txRef;

      // Mock axios.get for verification to fail once, then succeed
      let verifyAttemptCount = 0;
      axios.get.mockImplementation(() => {
        verifyAttemptCount++;
        if (verifyAttemptCount === 1) {
          const error = new Error('connect ECONNREFUSED');
          error.code = 'ECONNREFUSED';
          return Promise.reject(error);
        }
        return Promise.resolve({
          status: 200,
          data: {
            status: 'success',
            data: {
              status: 'success',
              amount: 5050.00,
              currency: 'ETB',
              tx_ref: txRef,
              payment_method: 'mobile_money',
              id: 'chapa-txn-123'
            }
          }
        });
      });

      // Verify payment
      const verifyResponse = await request(app)
        .get(`/api/payments/verify/${txRef}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
      expect(axios.get).toHaveBeenCalledTimes(2); // 1 failure + 1 success
    }, 30000);
  });
});
