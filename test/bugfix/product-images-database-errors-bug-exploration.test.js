/**
 * Bug Condition Exploration Tests for Product Images and Database Errors
 * 
 * CRITICAL: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
 * DO NOT attempt to fix the tests or the code when they fail
 * 
 * These tests encode the expected behavior - they will validate the fixes when they pass after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bugs exist
 * 
 * Bug 1 - Product Images: Test that product image URLs are returned as relative paths
 * Bug 2 - Review Query: Test that review queries fail with SQL error "Unknown column 'Review.createdAt'"
 * Bug 3 - Order Status Query: Test that review creation fails with SQL error "Unknown column 'order.status'"
 * 
 * Run with: node ecommerce-backend/test/bugfix/product-images-database-errors-bug-exploration.test.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test state
let authToken = null;
let testUser = null;
let testProduct = null;
let testOrder = null;
let testResults = {
  bug1_images: { passed: false, counterexample: null },
  bug2_reviews: { passed: false, counterexample: null },
  bug3_orders: { passed: false, counterexample: null }
};

// Helper function to login and get auth token
async function login() {
  console.log('\n=== Logging in as customer ===');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'customer@test.com',
      password: 'Customer123!'
    });
    
    authToken = response.data.data.accessToken;
    testUser = response.data.data.user;
    console.log('✓ Login successful');
    console.log(`  User ID: ${testUser.id}`);
    return true;
  } catch (error) {
    console.error('✗ Login failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Bug 1: Product Images Returned as Relative Paths
 * 
 * Expected Behavior (Property 1): Product image URLs must be fully qualified absolute URLs
 * Current Behavior: Images are returned as relative paths like "/uploads/image.jpg"
 * 
 * This test SHOULD FAIL on unfixed code, confirming the bug exists
 */
async function testBug1_ProductImages() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  BUG 1: Product Images as Relative Paths                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // Test GET /api/products
    console.log('\n--- Test 1.1: GET /api/products ---');
    const response = await axios.get(`${BASE_URL}/products`);
    
    if (!response.data.success || !response.data.data.products || response.data.data.products.length === 0) {
      console.log('⚠ No products found in database');
      testResults.bug1_images.counterexample = 'No products to test';
      return false;
    }
    
    const product = response.data.data.products[0];
    console.log(`Product: ${product.name}`);
    console.log(`Images:`, product.images);
    
    if (!product.images || product.images.length === 0) {
      console.log('⚠ Product has no images');
      testResults.bug1_images.counterexample = 'Product has no images';
      return false;
    }
    
    // Check if images are absolute URLs (expected behavior)
    const allAbsolute = product.images.every(img => 
      img.startsWith('http://') || img.startsWith('https://')
    );
    
    if (allAbsolute) {
      console.log('✓ PASS: All image URLs are absolute (bug is fixed)');
      testResults.bug1_images.passed = true;
      return true;
    } else {
      // Bug exists - images are relative paths
      console.log('✗ FAIL: Images are relative paths (bug confirmed)');
      console.log('COUNTEREXAMPLE:');
      console.log(`  Current: ${product.images[0]}`);
      console.log(`  Expected: http://localhost:5000${product.images[0]}`);
      testResults.bug1_images.counterexample = {
        current: product.images[0],
        expected: `http://localhost:5000${product.images[0]}`
      };
      return false;
    }
  } catch (error) {
    console.error('✗ Test error:', error.response?.data || error.message);
    testResults.bug1_images.counterexample = error.message;
    return false;
  }
}

/**
 * Bug 2: Review Query Uses Incorrect Column Name 'createdAt'
 * 
 * Expected Behavior (Property 2): Review queries must use 'created_at' (snake_case) in ORDER BY
 * Current Behavior: Query uses 'createdAt' causing SQL error "Unknown column 'Review.createdAt'"
 * 
 * This test SHOULD FAIL on unfixed code, confirming the bug exists
 */
async function testBug2_ReviewQuery() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  BUG 2: Review Query Column Name Error                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // First, get a product ID to test with
    const productsResponse = await axios.get(`${BASE_URL}/products`);
    if (!productsResponse.data.success || !productsResponse.data.data.products || productsResponse.data.data.products.length === 0) {
      console.log('⚠ No products found to test reviews');
      testResults.bug2_reviews.counterexample = 'No products to test';
      return false;
    }
    
    const productId = productsResponse.data.data.products[0].id;
    console.log(`\n--- Test 2.1: GET /api/reviews/product/${productId} ---`);
    
    // Test GET /api/reviews/product/:id
    const response = await axios.get(`${BASE_URL}/reviews/product/${productId}`);
    
    if (response.data.success) {
      console.log('✓ PASS: Review query succeeded (bug is fixed)');
      console.log(`  Retrieved ${response.data.data.reviews.length} reviews`);
      testResults.bug2_reviews.passed = true;
      return true;
    } else {
      console.log('✗ FAIL: Review query failed');
      testResults.bug2_reviews.counterexample = response.data;
      return false;
    }
  } catch (error) {
    // Expected to fail on unfixed code with SQL error
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    console.log('✗ FAIL: Review query threw error (bug confirmed)');
    console.log('COUNTEREXAMPLE:');
    console.log(`  Error: ${errorMsg}`);
    
    if (errorMsg.includes('createdAt') || errorMsg.includes('created_at') || errorMsg.includes('Unknown column')) {
      console.log('  ✓ Error confirms column name mismatch bug');
      testResults.bug2_reviews.counterexample = {
        error: errorMsg,
        expected: 'Query should use created_at (snake_case)',
        actual: 'Query uses createdAt (camelCase)'
      };
    } else {
      console.log('  ⚠ Error is different than expected');
      testResults.bug2_reviews.counterexample = errorMsg;
    }
    return false;
  }
}

/**
 * Bug 3: Order Status Query Uses Incorrect Column Name 'status'
 * 
 * Expected Behavior (Property 3): Order queries must use 'order_status' in WHERE clauses
 * Current Behavior: Query uses 'status' causing SQL error "Unknown column 'order.status'"
 * 
 * This test SHOULD FAIL on unfixed code, confirming the bug exists
 */
async function testBug3_OrderStatusQuery() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  BUG 3: Order Status Query Column Name Error              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // First, get a product that the user has purchased
    const productsResponse = await axios.get(`${BASE_URL}/products`);
    if (!productsResponse.data.success || !productsResponse.data.data.products || productsResponse.data.data.products.length === 0) {
      console.log('⚠ No products found to test review creation');
      testResults.bug3_orders.counterexample = 'No products to test';
      return false;
    }
    
    const productId = productsResponse.data.data.products[0].id;
    console.log(`\n--- Test 3.1: POST /api/reviews (product ${productId}) ---`);
    
    // Try to create a review (this will trigger the order status query)
    const response = await axios.post(
      `${BASE_URL}/reviews`,
      {
        productId: productId,
        rating: 5,
        comment: 'Test review for bug exploration'
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.data.success) {
      console.log('✓ PASS: Review creation succeeded (bug is fixed)');
      console.log(`  Review ID: ${response.data.data.review.id}`);
      testResults.bug3_orders.passed = true;
      return true;
    } else {
      console.log('✗ FAIL: Review creation failed');
      console.log(`  Message: ${response.data.message}`);
      
      // Check if it's the expected "not purchased" message (which means query worked)
      if (response.data.message && response.data.message.includes('purchased')) {
        console.log('  ✓ Query executed successfully (user hasn\'t purchased product)');
        testResults.bug3_orders.passed = true;
        return true;
      }
      
      testResults.bug3_orders.counterexample = response.data;
      return false;
    }
  } catch (error) {
    // Expected to fail on unfixed code with SQL error
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    console.log('✗ FAIL: Review creation threw error (bug confirmed)');
    console.log('COUNTEREXAMPLE:');
    console.log(`  Error: ${errorMsg}`);
    
    if (errorMsg.includes('status') || errorMsg.includes('order_status') || errorMsg.includes('Unknown column')) {
      console.log('  ✓ Error confirms column name mismatch bug');
      testResults.bug3_orders.counterexample = {
        error: errorMsg,
        expected: 'Query should use order_status',
        actual: 'Query uses status'
      };
    } else {
      console.log('  ⚠ Error is different than expected');
      testResults.bug3_orders.counterexample = errorMsg;
    }
    return false;
  }
}

// Main test execution
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Bug Exploration: Product Images and Database Errors      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nCRITICAL: These tests MUST FAIL on unfixed code');
  console.log('Failure confirms the bugs exist\n');
  
  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('\n✗ Cannot proceed without authentication');
    process.exit(1);
  }
  
  // Step 2: Test Bug 1 - Product Images
  await testBug1_ProductImages();
  
  // Step 3: Test Bug 2 - Review Query
  await testBug2_ReviewQuery();
  
  // Step 4: Test Bug 3 - Order Status Query
  await testBug3_OrderStatusQuery();
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nBug 1 - Product Images: ${testResults.bug1_images.passed ? '✓ FIXED' : '✗ EXISTS'}`);
  if (testResults.bug1_images.counterexample) {
    console.log('  Counterexample:', JSON.stringify(testResults.bug1_images.counterexample, null, 2));
  }
  
  console.log(`\nBug 2 - Review Query: ${testResults.bug2_reviews.passed ? '✓ FIXED' : '✗ EXISTS'}`);
  if (testResults.bug2_reviews.counterexample) {
    console.log('  Counterexample:', JSON.stringify(testResults.bug2_reviews.counterexample, null, 2));
  }
  
  console.log(`\nBug 3 - Order Status Query: ${testResults.bug3_orders.passed ? '✓ FIXED' : '✗ EXISTS'}`);
  if (testResults.bug3_orders.counterexample) {
    console.log('  Counterexample:', JSON.stringify(testResults.bug3_orders.counterexample, null, 2));
  }
  
  const allPassed = testResults.bug1_images.passed && testResults.bug2_reviews.passed && testResults.bug3_orders.passed;
  const allFailed = !testResults.bug1_images.passed && !testResults.bug2_reviews.passed && !testResults.bug3_orders.passed;
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      CONCLUSION                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  if (allFailed) {
    console.log('\n✓ Bug exploration complete: All bugs confirmed on unfixed code');
    console.log('  - Bug 1: Product images returned as relative paths');
    console.log('  - Bug 2: Review queries use incorrect column name');
    console.log('  - Bug 3: Order status queries use incorrect column name');
    console.log('\nNext step: Implement fixes in productController.js and reviewController.js');
  } else if (allPassed) {
    console.log('\n✓ All tests passed: Bugs are fixed!');
    console.log('  - Product images are absolute URLs');
    console.log('  - Review queries use correct column names');
    console.log('  - Order status queries use correct column names');
  } else {
    console.log('\n⚠ Mixed results: Some bugs fixed, some still exist');
    console.log('  Review individual test results above for details');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\n✗ Test execution failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
