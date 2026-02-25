const { User, Order, Payment, Cart, CartItem, Product, Seller, Category } = require('../models');
const sequelize = require('../config/database');
const paymentController = require('../controllers/paymentController');
const chapaService = require('../services/chapaService');

// Mock response object
const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

async function testPaymentController() {
  console.log('\n=== Testing Payment Controller ===\n');

  try {
    // Sync database without force (don't drop tables)
    await sequelize.sync();
    console.log('✓ Database synced');

    // Create test user
    const timestamp = Date.now();
    const user = await User.create({
      email: `customer${timestamp}@test.com`,
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'customer'
    });
    console.log('✓ Test user created');

    // Create test seller
    const sellerUser = await User.create({
      email: `seller${timestamp}@test.com`,
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'seller'
    });

    const seller = await Seller.create({
      userId: sellerUser.id,
      businessName: 'Test Store',
      businessDescription: 'Test Description',
      businessAddress: 'Test Address',
      phoneNumber: '1234567890'
    });
    console.log('✓ Test seller created');

    // Create test category
    const category = await Category.create({
      name: 'Electronics',
      description: 'Electronic items'
    });

    // Create test product
    const product = await Product.create({
      sellerId: seller.id,
      categoryId: category.id,
      name: 'Test Product',
      description: 'Test Description',
      price: 100.00,
      stock: 10,
      images: ['test.jpg']
    });
    console.log('✓ Test product created');

    // Create test order
    const order = await Order.create({
      userId: user.id,
      totalAmount: 100.00,
      status: 'pending',
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        country: 'Ethiopia'
      }
    });
    console.log('✓ Test order created');

    // Test 1: Initiate Payment
    console.log('\n--- Test 1: Initiate Payment ---');
    const req1 = {
      body: { orderId: order.id },
      user: { id: user.id }
    };
    const res1 = mockResponse();

    // Mock chapaService.initializePayment
    const originalInitialize = chapaService.initializePayment;
    chapaService.initializePayment = async () => ({
      paymentUrl: 'https://checkout.chapa.co/test',
      reference: `order-${order.id}-${Date.now()}`
    });

    await paymentController.initiatePayment(req1, res1);
    
    if (res1.statusCode === 200 && res1.body.success) {
      console.log('✓ Payment initiated successfully');
      console.log('  Payment URL:', res1.body.data.paymentUrl);
      console.log('  Reference:', res1.body.data.reference);
    } else {
      console.log('✗ Payment initiation failed:', res1.body);
    }

    // Restore original function
    chapaService.initializePayment = originalInitialize;

    // Test 2: Initiate Payment for Non-existent Order
    console.log('\n--- Test 2: Initiate Payment for Non-existent Order ---');
    const req2 = {
      body: { orderId: 99999 },
      user: { id: user.id }
    };
    const res2 = mockResponse();

    await paymentController.initiatePayment(req2, res2);
    
    if (res2.statusCode === 404 && !res2.body.success) {
      console.log('✓ Correctly rejected non-existent order');
    } else {
      console.log('✗ Should have rejected non-existent order');
    }

    // Test 3: Handle Webhook - Success
    console.log('\n--- Test 3: Handle Webhook - Success ---');
    
    // Use the payment created in test 1
    const existingPayment = await Payment.findOne({ where: { orderId: order.id } });
    const testReference = existingPayment.chapaReference;

    const req3 = {
      headers: { 'chapa-signature': 'test-signature' },
      body: {
        tx_ref: testReference,
        status: 'success',
        amount: 100,
        payment_method: 'telebirr'
      }
    };
    const res3 = mockResponse();

    // Mock signature verification
    const originalVerify = chapaService.verifyWebhookSignature;
    chapaService.verifyWebhookSignature = () => true;

    await paymentController.handleWebhook(req3, res3);
    
    if (res3.statusCode === 200 && res3.body.success) {
      console.log('✓ Webhook processed successfully');
      
      // Verify payment status updated
      const updatedPayment = await Payment.findByPk(existingPayment.id);
      const updatedOrder = await Order.findByPk(order.id);
      
      if (updatedPayment.status === 'success' && updatedOrder.status === 'paid') {
        console.log('✓ Payment and order status updated correctly');
      } else {
        console.log('✗ Payment or order status not updated correctly');
      }
    } else {
      console.log('✗ Webhook processing failed:', res3.body);
    }

    // Restore original function
    chapaService.verifyWebhookSignature = originalVerify;

    // Test 4: Handle Webhook - Failed Payment
    console.log('\n--- Test 4: Handle Webhook - Failed Payment ---');
    
    // Create another order and payment
    const order2 = await Order.create({
      userId: user.id,
      totalAmount: 200.00,
      status: 'pending',
      shippingAddress: {
        street: '456 Test St',
        city: 'Test City',
        country: 'Ethiopia'
      }
    });

    const payment2 = await Payment.create({
      orderId: order2.id,
      amount: 200.00,
      chapaReference: `test-ref-${Date.now()}`,
      status: 'pending'
    });

    const req4 = {
      headers: { 'chapa-signature': 'test-signature' },
      body: {
        tx_ref: payment2.chapaReference,
        status: 'failed',
        amount: 200
      }
    };
    const res4 = mockResponse();

    // Mock signature verification
    chapaService.verifyWebhookSignature = () => true;

    await paymentController.handleWebhook(req4, res4);
    
    if (res4.statusCode === 200 && res4.body.success) {
      console.log('✓ Failed payment webhook processed');
      
      // Verify payment status updated
      const updatedPayment2 = await Payment.findByPk(payment2.id);
      const updatedOrder2 = await Order.findByPk(order2.id);
      
      if (updatedPayment2.status === 'failed' && updatedOrder2.status === 'payment_failed') {
        console.log('✓ Failed payment and order status updated correctly');
      } else {
        console.log('✗ Failed payment or order status not updated correctly');
      }
    } else {
      console.log('✗ Failed payment webhook processing failed:', res4.body);
    }

    // Restore original function
    chapaService.verifyWebhookSignature = originalVerify;

    // Test 5: Verify Payment
    console.log('\n--- Test 5: Verify Payment ---');
    
    // Use the existing payment reference
    const paymentToVerify = await Payment.findOne({ where: { orderId: order2.id } });
    
    const req5 = {
      params: { reference: paymentToVerify.chapaReference }
    };
    const res5 = mockResponse();

    // Mock chapaService.verifyPayment
    const originalVerifyPayment = chapaService.verifyPayment;
    chapaService.verifyPayment = async () => ({
      status: 'failed',
      amount: 200,
      currency: 'ETB',
      reference: paymentToVerify.chapaReference,
      paymentMethod: 'telebirr'
    });

    await paymentController.verifyPayment(req5, res5);
    
    if (res5.statusCode === 200 && res5.body.success) {
      console.log('✓ Payment verification successful');
      console.log('  Payment status:', res5.body.data.payment.status);
    } else {
      console.log('✗ Payment verification failed:', res5.body);
    }

    // Restore original function
    chapaService.verifyPayment = originalVerifyPayment;

    // Test 6: Verify Payment with Invalid Reference
    console.log('\n--- Test 6: Verify Payment with Invalid Reference ---');
    
    const req6 = {
      params: { reference: 'invalid-ref' }
    };
    const res6 = mockResponse();

    await paymentController.verifyPayment(req6, res6);
    
    if (res6.statusCode === 404 && !res6.body.success) {
      console.log('✓ Correctly rejected invalid reference');
    } else {
      console.log('✗ Should have rejected invalid reference');
    }

    // Test 7: Handle Webhook with Invalid Signature
    console.log('\n--- Test 7: Handle Webhook with Invalid Signature ---');
    
    const req7 = {
      headers: { 'chapa-signature': 'invalid-signature' },
      body: {
        tx_ref: 'test-ref-123',
        status: 'success',
        amount: 100
      }
    };
    const res7 = mockResponse();

    // Use real signature verification (will fail)
    await paymentController.handleWebhook(req7, res7);
    
    if (res7.statusCode === 401 && !res7.body.success) {
      console.log('✓ Correctly rejected invalid webhook signature');
    } else {
      console.log('✗ Should have rejected invalid webhook signature');
    }

    console.log('\n=== Payment Controller Tests Complete ===\n');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await sequelize.close();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testPaymentController();
}

module.exports = testPaymentController;
