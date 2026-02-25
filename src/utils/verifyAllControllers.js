/**
 * Comprehensive Controller Verification Script
 * Tests all controllers for:
 * - Function presence
 * - Error handling
 * - Authorization logic
 * - Basic functionality
 */

const { sequelize, User, Seller, Product, Category, Cart, CartItem, Order, OrderItem, Review } = require('../models');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const sellerController = require('../controllers/sellerController');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');
const cartController = require('../controllers/cartController');
const orderController = require('../controllers/orderController');
const reviewController = require('../controllers/reviewController');

// Mock request/response helpers
const mockRequest = (data = {}) => ({
  body: data.body || {},
  params: data.params || {},
  query: data.query || {},
  user: data.user || {},
  file: data.file || null,
  files: data.files || null
});

const mockResponse = () => {
  const res = {};
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.data = data;
    return this;
  };
  return res;
};

const mockNext = (error) => {
  if (error) {
    console.log('  ⚠️  Error caught by next():', error.message);
  }
};

// Test data storage
let testData = {};

async function setupTestData() {
  console.log('\n📦 Setting up test data...\n');

  // Create test users
  testData.customer = await User.create({
    email: 'verify.customer@test.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'Customer',
    role: 'customer',
    isActive: true
  });

  testData.sellerUser = await User.create({
    email: 'verify.seller@test.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'Seller',
    role: 'seller',
    isActive: true
  });

  testData.adminUser = await User.create({
    email: 'verify.admin@test.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin',
    isActive: true
  });

  // Create seller profile
  testData.seller = await Seller.create({
    userId: testData.sellerUser.id,
    businessName: 'Test Business',
    businessDescription: 'A test business',
    businessAddress: '123 Test St',
    phoneNumber: '1234567890'
  });

  // Create category
  testData.category = await Category.create({
    name: 'Test Category',
    description: 'Test category description'
  });

  // Create product
  testData.product = await Product.create({
    sellerId: testData.seller.id,
    categoryId: testData.category.id,
    name: 'Test Product',
    description: 'Test product description',
    price: 99.99,
    stock: 10,
    images: ['/uploads/test.jpg'],
    isActive: true
  });

  console.log('✓ Test data created\n');
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...\n');
  
  try {
    await Review.destroy({ where: {} });
    await OrderItem.destroy({ where: {} });
    await Order.destroy({ where: {} });
    await CartItem.destroy({ where: {} });
    await Cart.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await Category.destroy({ where: {} });
    await Seller.destroy({ where: {} });
    await User.destroy({ where: {} });
    console.log('✓ Test data cleaned up\n');
  } catch (error) {
    console.log('⚠️  Cleanup warning:', error.message);
  }
}

// Controller verification functions
async function verifyAuthController() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔐 VERIFYING AUTH CONTROLLER');
  console.log('═══════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'register() - Valid registration',
      fn: async () => {
        const req = mockRequest({
          body: {
            email: 'newuser@test.com',
            password: 'password123',
            firstName: 'New',
            lastName: 'User',
            role: 'customer'
          }
        });
        const res = mockResponse();
        await authController.register(req, res, mockNext);
        return res.statusCode === 201 && res.data.success;
      }
    },
    {
      name: 'login() - Valid credentials',
      fn: async () => {
        const req = mockRequest({
          body: {
            email: testData.customer.email,
            password: 'password123'
          }
        });
        const res = mockResponse();
        await authController.login(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.accessToken && res.data.data.refreshToken;
      }
    },
    {
      name: 'login() - Invalid credentials (error handling)',
      fn: async () => {
        const req = mockRequest({
          body: {
            email: testData.customer.email,
            password: 'wrongpassword'
          }
        });
        const res = mockResponse();
        await authController.login(req, res, mockNext);
        return res.statusCode === 401 && !res.data.success;
      }
    },
    {
      name: 'getProfile() - Get user profile',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.customer.id }
        });
        const res = mockResponse();
        await authController.getProfile(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.user.email === testData.customer.email;
      }
    }
  ];

  await runTests(tests);
}

async function verifyUserController() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('👤 VERIFYING USER CONTROLLER');
  console.log('═══════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'getAllUsers() - Admin access',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.adminUser.id, role: 'admin' }
        });
        const res = mockResponse();
        await userController.getAllUsers(req, res, mockNext);
        return res.statusCode === 200 && Array.isArray(res.data.data.users);
      }
    },
    {
      name: 'getUserById() - Get user details',
      fn: async () => {
        const req = mockRequest({
          params: { id: testData.customer.id },
          user: { id: testData.customer.id }
        });
        const res = mockResponse();
        await userController.getUserById(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.user.id === testData.customer.id;
      }
    },
    {
      name: 'updateUser() - Update own profile',
      fn: async () => {
        const req = mockRequest({
          params: { id: testData.customer.id },
          body: { firstName: 'Updated' },
          user: { id: testData.customer.id }
        });
        const res = mockResponse();
        await userController.updateUser(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.user.firstName === 'Updated';
      }
    }
  ];

  await runTests(tests);
}

async function verifySellerController() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🏪 VERIFYING SELLER CONTROLLER');
  console.log('═══════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'getSellerProfile() - Get seller profile',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.sellerUser.id }
        });
        const res = mockResponse();
        await sellerController.getSellerProfile(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.seller.businessName === 'Test Business';
      }
    },
    {
      name: 'updateSellerProfile() - Update seller info',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.sellerUser.id },
          body: { businessName: 'Updated Business' }
        });
        const res = mockResponse();
        await sellerController.updateSellerProfile(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.seller.businessName === 'Updated Business';
      }
    },
    {
      name: 'getSellerDashboard() - Get dashboard stats',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.sellerUser.id }
        });
        const res = mockResponse();
        await sellerController.getSellerDashboard(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.dashboard;
      }
    }
  ];

  await runTests(tests);
}

async function verifyCategoryController() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📁 VERIFYING CATEGORY CONTROLLER');
  console.log('═══════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'getAllCategories() - Get all categories',
      fn: async () => {
        const req = mockRequest({});
        const res = mockResponse();
        await categoryController.getAllCategories(req, res, mockNext);
        return res.statusCode === 200 && Array.isArray(res.data.data.categories);
      }
    },
    {
      name: 'createCategory() - Admin creates category',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.adminUser.id, role: 'admin' },
          body: {
            name: 'New Category',
            description: 'New category description'
          }
        });
        const res = mockResponse();
        await categoryController.createCategory(req, res, mockNext);
        return res.statusCode === 201 && res.data.data.category.name === 'New Category';
      }
    }
  ];

  await runTests(tests);
}

async function verifyProductController() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📦 VERIFYING PRODUCT CONTROLLER');
  console.log('═══════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'getAllProducts() - Get product catalog',
      fn: async () => {
        const req = mockRequest({
          query: { page: 1, limit: 10 }
        });
        const res = mockResponse();
        await productController.getAllProducts(req, res, mockNext);
        return res.statusCode === 200 && Array.isArray(res.data.data.products);
      }
    },
    {
      name: 'getProductById() - Get product details',
      fn: async () => {
        const req = mockRequest({
          params: { id: testData.product.id }
        });
        const res = mockResponse();
        await productController.getProductById(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.product.id === testData.product.id;
      }
    },
    {
      name: 'updateProduct() - Seller updates own product',
      fn: async () => {
        const req = mockRequest({
          params: { id: testData.product.id },
          user: { id: testData.sellerUser.id, role: 'seller' },
          body: { name: 'Updated Product' }
        });
        const res = mockResponse();
        await productController.updateProduct(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.product.name === 'Updated Product';
      }
    },
    {
      name: 'updateProduct() - Authorization check (wrong seller)',
      fn: async () => {
        const wrongSeller = await User.create({
          email: 'wrong.seller@test.com',
          password: 'password123',
          firstName: 'Wrong',
          lastName: 'Seller',
          role: 'seller'
        });
        const req = mockRequest({
          params: { id: testData.product.id },
          user: { id: wrongSeller.id, role: 'seller' },
          body: { name: 'Hacked Product' }
        });
        const res = mockResponse();
        await productController.updateProduct(req, res, mockNext);
        return res.statusCode === 403 && !res.data.success;
      }
    },
    {
      name: 'searchProducts() - Search functionality',
      fn: async () => {
        const req = mockRequest({
          query: { keyword: 'Updated', page: 1, limit: 10 }
        });
        const res = mockResponse();
        await productController.searchProducts(req, res, mockNext);
        return res.statusCode === 200 && Array.isArray(res.data.data.products);
      }
    }
  ];

  await runTests(tests);
}

async function verifyCartController() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🛒 VERIFYING CART CONTROLLER');
  console.log('═══════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'getCart() - Get empty cart',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.customer.id }
        });
        const res = mockResponse();
        await cartController.getCart(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.cart;
      }
    },
    {
      name: 'addToCart() - Add item to cart',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.customer.id },
          body: { productId: testData.product.id, quantity: 2 }
        });
        const res = mockResponse();
        await cartController.addToCart(req, res, mockNext);
        return res.statusCode === 200 && res.data.success;
      }
    },
    {
      name: 'addToCart() - Stock validation (error handling)',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.customer.id },
          body: { productId: testData.product.id, quantity: 1000 }
        });
        const res = mockResponse();
        await cartController.addToCart(req, res, mockNext);
        return res.statusCode === 400 && !res.data.success;
      }
    },
    {
      name: 'getCart() - Get cart with items',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.customer.id }
        });
        const res = mockResponse();
        await cartController.getCart(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.cart.itemCount > 0;
      }
    }
  ];

  await runTests(tests);
}

async function verifyOrderController() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📋 VERIFYING ORDER CONTROLLER');
  console.log('═══════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'createOrder() - Create order from cart',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.customer.id, role: 'customer' },
          body: {
            shippingAddress: {
              street: '123 Test St',
              city: 'Test City',
              state: 'TS',
              zipCode: '12345',
              country: 'Test Country'
            }
          }
        });
        const res = mockResponse();
        await orderController.createOrder(req, res, mockNext);
        if (res.statusCode === 201) {
          testData.order = res.data.data.order;
        }
        return res.statusCode === 201 && res.data.data.order;
      }
    },
    {
      name: 'getOrders() - Customer gets own orders',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.customer.id, role: 'customer' }
        });
        const res = mockResponse();
        await orderController.getOrders(req, res, mockNext);
        return res.statusCode === 200 && Array.isArray(res.data.data.orders);
      }
    },
    {
      name: 'getOrderById() - Get order details',
      fn: async () => {
        if (!testData.order) return false;
        const req = mockRequest({
          user: { id: testData.customer.id, role: 'customer' },
          params: { id: testData.order.id }
        });
        const res = mockResponse();
        await orderController.getOrderById(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.order.id === testData.order.id;
      }
    },
    {
      name: 'getOrders() - Seller gets relevant orders',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.sellerUser.id, role: 'seller' }
        });
        const res = mockResponse();
        await orderController.getOrders(req, res, mockNext);
        return res.statusCode === 200 && Array.isArray(res.data.data.orders);
      }
    }
  ];

  await runTests(tests);
}

async function verifyReviewController() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('⭐ VERIFYING REVIEW CONTROLLER');
  console.log('═══════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'createReview() - Create review (with purchase)',
      fn: async () => {
        const req = mockRequest({
          user: { id: testData.customer.id },
          body: {
            productId: testData.product.id,
            rating: 5,
            comment: 'Great product!'
          }
        });
        const res = mockResponse();
        await reviewController.createReview(req, res, mockNext);
        if (res.statusCode === 201) {
          testData.review = res.data.data.review;
        }
        return res.statusCode === 201 && res.data.data.review;
      }
    },
    {
      name: 'getProductReviews() - Get reviews for product',
      fn: async () => {
        const req = mockRequest({
          params: { productId: testData.product.id },
          query: { page: 1, limit: 10 }
        });
        const res = mockResponse();
        await reviewController.getProductReviews(req, res, mockNext);
        return res.statusCode === 200 && Array.isArray(res.data.data.reviews);
      }
    },
    {
      name: 'updateReview() - Update own review',
      fn: async () => {
        if (!testData.review) return false;
        const req = mockRequest({
          user: { id: testData.customer.id },
          params: { id: testData.review.id },
          body: { rating: 4, comment: 'Updated review' }
        });
        const res = mockResponse();
        await reviewController.updateReview(req, res, mockNext);
        return res.statusCode === 200 && res.data.data.review.rating === 4;
      }
    },
    {
      name: 'updateReview() - Authorization check (wrong user)',
      fn: async () => {
        if (!testData.review) return false;
        const req = mockRequest({
          user: { id: testData.sellerUser.id },
          params: { id: testData.review.id },
          body: { rating: 1, comment: 'Hacked' }
        });
        const res = mockResponse();
        await reviewController.updateReview(req, res, mockNext);
        return res.statusCode === 403 && !res.data.success;
      }
    }
  ];

  await runTests(tests);
}

async function runTests(tests) {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
}

async function main() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║     COMPREHENSIVE CONTROLLER VERIFICATION SUITE      ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    await sequelize.authenticate();
    console.log('✓ Database connected\n');

    await cleanupTestData();
    await setupTestData();

    await verifyAuthController();
    await verifyUserController();
    await verifySellerController();
    await verifyCategoryController();
    await verifyProductController();
    await verifyCartController();
    await verifyOrderController();
    await verifyReviewController();

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL CONTROLLER VERIFICATIONS COMPLETED');
    console.log('═══════════════════════════════════════════════════════\n');

    await cleanupTestData();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
