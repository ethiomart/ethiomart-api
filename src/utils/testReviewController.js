const sequelize = require('../config/database');
const { User, Seller, Product, Order, OrderItem, Review } = require('../models');
const reviewController = require('../controllers/reviewController');

// Mock request and response objects
const mockRequest = (data = {}) => ({
  body: data.body || {},
  params: data.params || {},
  query: data.query || {},
  user: data.user || {}
});

const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

const mockNext = (error) => {
  if (error) console.error('Error passed to next:', error);
};

async function testReviewController() {
  try {
    console.log('Starting Review Controller Tests...\n');

    // Clean up test data without truncate to avoid FK issues
    await Review.destroy({ where: {} });
    await OrderItem.destroy({ where: {} });
    await Order.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await Seller.destroy({ where: {} });
    await User.destroy({ where: {} });
    console.log('✓ Database cleaned\n');

    // Create test users
    const customer = await User.create({
      email: 'customer@test.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'customer'
    });

    const sellerUser = await User.create({
      email: 'seller@test.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'seller'
    });

    const seller = await Seller.create({
      userId: sellerUser.id,
      businessName: 'Test Store',
      businessDescription: 'A test store',
      businessAddress: '123 Test St',
      phoneNumber: '1234567890'
    });

    console.log('✓ Test users created\n');

    // Create test product
    const product = await Product.create({
      sellerId: seller.id,
      name: 'Test Product',
      description: 'A test product',
      price: 99.99,
      stock: 10,
      images: ['/uploads/test.jpg']
    });

    console.log('✓ Test product created\n');

    // Create test order (customer purchased the product)
    const order = await Order.create({
      userId: customer.id,
      totalAmount: 99.99,
      status: 'paid',
      shippingAddress: {
        street: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      }
    });

    await OrderItem.create({
      orderId: order.id,
      productId: product.id,
      sellerId: seller.id,
      quantity: 1,
      priceAtPurchase: 99.99,
      status: 'pending'
    });

    console.log('✓ Test order created\n');

    // Test 1: Create review (should succeed - customer purchased product)
    console.log('Test 1: Create review for purchased product');
    const req1 = mockRequest({
      body: {
        productId: product.id,
        rating: 5,
        comment: 'Great product!'
      },
      user: { id: customer.id }
    });
    const res1 = mockResponse();
    await reviewController.createReview(req1, res1, mockNext);
    console.log(`Status: ${res1.statusCode}`);
    console.log(`Success: ${res1.data?.success}`);
    console.log(`Message: ${res1.data?.message}`);
    console.log(`Review ID: ${res1.data?.data?.review?.id}\n`);

    // Test 2: Try to create duplicate review (should fail)
    console.log('Test 2: Try to create duplicate review');
    const req2 = mockRequest({
      body: {
        productId: product.id,
        rating: 4,
        comment: 'Another review'
      },
      user: { id: customer.id }
    });
    const res2 = mockResponse();
    await reviewController.createReview(req2, res2, mockNext);
    console.log(`Status: ${res2.statusCode}`);
    console.log(`Success: ${res2.data?.success}`);
    console.log(`Message: ${res2.data?.message}\n`);

    // Test 3: Try to create review without purchase (should fail)
    console.log('Test 3: Try to create review without purchase');
    const nonBuyer = await User.create({
      email: 'nonbuyer@test.com',
      password: 'password123',
      firstName: 'Non',
      lastName: 'Buyer',
      role: 'customer'
    });
    const req3 = mockRequest({
      body: {
        productId: product.id,
        rating: 3,
        comment: 'I did not buy this'
      },
      user: { id: nonBuyer.id }
    });
    const res3 = mockResponse();
    await reviewController.createReview(req3, res3, mockNext);
    console.log(`Status: ${res3.statusCode}`);
    console.log(`Success: ${res3.data?.success}`);
    console.log(`Message: ${res3.data?.message}\n`);

    // Test 4: Get product reviews
    console.log('Test 4: Get product reviews');
    const req4 = mockRequest({
      params: { productId: product.id },
      query: { page: 1, limit: 10 }
    });
    const res4 = mockResponse();
    await reviewController.getProductReviews(req4, res4, mockNext);
    console.log(`Status: ${res4.statusCode}`);
    console.log(`Success: ${res4.data?.success}`);
    console.log(`Total Reviews: ${res4.data?.data?.totalReviews}`);
    console.log(`Average Rating: ${res4.data?.data?.averageRating}\n`);

    // Test 5: Update own review
    console.log('Test 5: Update own review');
    const review = await Review.findOne({ where: { userId: customer.id } });
    const req5 = mockRequest({
      params: { id: review.id },
      body: {
        rating: 4,
        comment: 'Updated review - still good!'
      },
      user: { id: customer.id }
    });
    const res5 = mockResponse();
    await reviewController.updateReview(req5, res5, mockNext);
    console.log(`Status: ${res5.statusCode}`);
    console.log(`Success: ${res5.data?.success}`);
    console.log(`Message: ${res5.data?.message}`);
    console.log(`Updated Rating: ${res5.data?.data?.review?.rating}\n`);

    // Test 6: Try to update someone else's review (should fail)
    console.log('Test 6: Try to update someone else\'s review');
    const req6 = mockRequest({
      params: { id: review.id },
      body: {
        rating: 1,
        comment: 'Hacking attempt'
      },
      user: { id: nonBuyer.id }
    });
    const res6 = mockResponse();
    await reviewController.updateReview(req6, res6, mockNext);
    console.log(`Status: ${res6.statusCode}`);
    console.log(`Success: ${res6.data?.success}`);
    console.log(`Message: ${res6.data?.message}\n`);

    // Test 7: Delete own review
    console.log('Test 7: Delete own review');
    const req7 = mockRequest({
      params: { id: review.id },
      user: { id: customer.id }
    });
    const res7 = mockResponse();
    await reviewController.deleteReview(req7, res7, mockNext);
    console.log(`Status: ${res7.statusCode}`);
    console.log(`Success: ${res7.data?.success}`);
    console.log(`Message: ${res7.data?.message}\n`);

    // Test 8: Verify review was deleted
    console.log('Test 8: Verify review was deleted');
    const req8 = mockRequest({
      params: { productId: product.id },
      query: { page: 1, limit: 10 }
    });
    const res8 = mockResponse();
    await reviewController.getProductReviews(req8, res8, mockNext);
    console.log(`Status: ${res8.statusCode}`);
    console.log(`Total Reviews: ${res8.data?.data?.totalReviews}`);
    console.log(`Average Rating: ${res8.data?.data?.averageRating}\n`);

    console.log('✅ All Review Controller tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Run tests
testReviewController();
