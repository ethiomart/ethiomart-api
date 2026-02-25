/**
 * Preservation Property Tests for Cart Add-to-Cart Response Fix
 * 
 * GOAL: Verify that non-addToCart cart operations continue to work correctly
 * after the fix to addToCart endpoint.
 * 
 * METHODOLOGY:
 * 1. These tests verify preservation of existing behavior
 * 2. Run on FIXED code to ensure no regressions
 * 3. After fix is implemented, re-run to ensure no regressions
 * 
 * Property 2: Preservation - Other Cart Operations
 * 
 * For any cart operation that is NOT addToCart (POST /api/cart/items),
 * the fixed backend SHALL produce exactly the same behavior as before the fix.
 * 
 * Test Coverage:
 * - getCart endpoint (GET /api/cart)
 * - updateCartItem endpoint (PUT /api/cart/items/:id)
 * - removeFromCart endpoint (DELETE /api/cart/items/:id)
 * - clearCart endpoint (DELETE /api/cart)
 * - Error handling for invalid requests
 * - Stock validation logic
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test credentials
const TEST_USER = {
  email: 'customer@test.com',
  password: 'Customer123!'
};

let authToken = '';
let testProductId = null;
let secondProductId = null;
let cartItemId = null;

async function runPreservationTests() {
  console.log('🧪 Cart Fix Preservation Property Tests\n');
  console.log('=' .repeat(70));
  console.log('GOAL: Verify non-addToCart cart operations remain unchanged');
  console.log('=' .repeat(70));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    // Setup
    await login();
    await getTestProducts();
    await setupTestCart();

    // Run preservation tests
    await testGetCart(results);
    await testUpdateCartItem(results);
    await testRemoveFromCart(results);
    await testClearCart(results);
    await testErrorHandling(results);
    await testStockValidation(results);

    // Print summary
    printSummary(results);

    // Exit with appropriate code
    if (results.failed === 0) {
      console.log('\n✅ All preservation tests PASSED');
      console.log('   Other cart operations are working correctly');
      console.log('   Baseline behavior is preserved\n');
      process.exit(0);
    } else {
      console.log('\n❌ Some preservation tests FAILED');
      console.log('   This indicates regressions in cart operations');
      console.log('   Review the errors above\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 UNEXPECTED ERROR during preservation tests:');
    console.error(`   ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

/**
 * Login and get auth token
 */
async function login() {
  try {
    console.log('\n📝 Setup: Logging in...');
    const response = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    
    if (response.data.success && response.data.data.accessToken) {
      authToken = response.data.data.accessToken;
      console.log('   ✓ Login successful');
    } else {
      throw new Error('Login failed');
    }
  } catch (error) {
    throw new Error(`Login error: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Get test products
 */
async function getTestProducts() {
  try {
    console.log('📝 Setup: Fetching test products...');
    const response = await axios.get(`${BASE_URL}/products?limit=5`);
    
    if (response.data.success && response.data.data.products.length >= 2) {
      testProductId = response.data.data.products[0].id;
      secondProductId = response.data.data.products[1].id;
      console.log(`   ✓ Found test products: ${testProductId}, ${secondProductId}`);
    } else {
      throw new Error('Not enough products found');
    }
  } catch (error) {
    throw new Error(`Error fetching products: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Setup test cart with items
 */
async function setupTestCart() {
  try {
    console.log('📝 Setup: Creating test cart...');
    
    // Clear cart first
    try {
      await axios.delete(`${BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
    } catch (e) {
      // Cart might not exist, that's okay
    }

    // Add first item
    const response = await axios.post(
      `${BASE_URL}/cart/items`,
      { productId: testProductId, quantity: 1 },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    if (response.data.success && response.data.data.items.length > 0) {
      cartItemId = response.data.data.items[0].id;
      console.log(`   ✓ Test cart created with item ID: ${cartItemId}`);
    } else {
      throw new Error('Failed to create test cart');
    }
  } catch (error) {
    throw new Error(`Setup cart error: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Test 1: getCart endpoint preservation
 */
async function testGetCart(results) {
  console.log('\n🧪 Test 1: getCart Endpoint Preservation');
  console.log('-'.repeat(70));

  try {
    const response = await axios.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const cart = response.data.data.cart;

    // Verify getCart returns full cart object
    const checks = [
      { name: 'Response is successful', pass: response.data.success === true },
      { name: 'Cart has id', pass: cart.id !== undefined },
      { name: 'Cart has userId', pass: cart.userId !== undefined },
      { name: 'Cart has items array', pass: Array.isArray(cart.items) },
      { name: 'Cart has total', pass: typeof cart.total === 'number' },
      { name: 'Cart has itemCount', pass: typeof cart.itemCount === 'number' },
      { name: 'Cart has createdAt', pass: cart.createdAt !== undefined },
      { name: 'Cart has updatedAt', pass: cart.updatedAt !== undefined },
      { name: 'Items have product details', pass: cart.items.length > 0 && cart.items[0].product !== undefined }
    ];

    let allPassed = true;
    checks.forEach(check => {
      const status = check.pass ? '✓' : '✗';
      console.log(`   ${status} ${check.name}`);
      if (!check.pass) allPassed = false;
    });

    if (allPassed) {
      console.log('   ✅ PASSED: getCart endpoint works correctly');
      results.passed++;
      results.tests.push({ name: 'getCart Preservation', status: 'PASSED' });
    } else {
      console.log('   ❌ FAILED: getCart endpoint has issues');
      results.failed++;
      results.tests.push({ name: 'getCart Preservation', status: 'FAILED' });
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.response?.data?.message || error.message}`);
    results.failed++;
    results.tests.push({ name: 'getCart Preservation', status: 'FAILED', error: error.message });
  }
}

/**
 * Test 2: updateCartItem endpoint preservation
 */
async function testUpdateCartItem(results) {
  console.log('\n🧪 Test 2: updateCartItem Endpoint Preservation');
  console.log('-'.repeat(70));

  try {
    // Get the current cart to find the product ID
    const cartResponse = await axios.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const currentItem = cartResponse.data.data.cart.items.find(item => item.id === cartItemId);
    if (!currentItem) {
      throw new Error('Cart item not found in cart');
    }

    const response = await axios.put(
      `${BASE_URL}/cart/items/${cartItemId}`,
      { 
        productId: currentItem.product_id,  // Include productId as required by validation
        quantity: 2 
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const checks = [
      { name: 'Response is successful', pass: response.data.success === true },
      { name: 'Message indicates update', pass: response.data.message.includes('updated') || response.data.message.includes('Cart') },
      { name: 'Response has data', pass: response.data.data !== undefined }
    ];

    let allPassed = true;
    checks.forEach(check => {
      const status = check.pass ? '✓' : '✗';
      console.log(`   ${status} ${check.name}`);
      if (!check.pass) allPassed = false;
    });

    // Verify the update actually worked
    const getCartResponse = await axios.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const updatedItem = getCartResponse.data.data.cart.items.find(item => item.id === cartItemId);
    
    if (updatedItem && updatedItem.quantity === 2) {
      console.log('   ✓ Quantity updated correctly to 2');
    } else {
      console.log('   ✗ Quantity not updated correctly');
      allPassed = false;
    }

    if (allPassed) {
      console.log('   ✅ PASSED: updateCartItem endpoint works correctly');
      results.passed++;
      results.tests.push({ name: 'updateCartItem Preservation', status: 'PASSED' });
    } else {
      console.log('   ❌ FAILED: updateCartItem endpoint has issues');
      results.failed++;
      results.tests.push({ name: 'updateCartItem Preservation', status: 'FAILED' });
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log(`   Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    results.failed++;
    results.tests.push({ name: 'updateCartItem Preservation', status: 'FAILED', error: error.message });
  }
}

/**
 * Test 3: removeFromCart endpoint preservation
 */
async function testRemoveFromCart(results) {
  console.log('\n🧪 Test 3: removeFromCart Endpoint Preservation');
  console.log('-'.repeat(70));

  try {
    // Add a second item to remove
    const addResponse = await axios.post(
      `${BASE_URL}/cart/items`,
      { productId: secondProductId, quantity: 1 },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const itemToRemove = addResponse.data.data.items.find(item => item.product_id === secondProductId);
    
    if (!itemToRemove) {
      throw new Error('Could not find item to remove');
    }

    // Remove the item
    const response = await axios.delete(
      `${BASE_URL}/cart/items/${itemToRemove.id}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const checks = [
      { name: 'Response is successful', pass: response.data.success === true },
      { name: 'Message indicates removal', pass: response.data.message.includes('removed') || response.data.message.includes('deleted') }
    ];

    let allPassed = true;
    checks.forEach(check => {
      const status = check.pass ? '✓' : '✗';
      console.log(`   ${status} ${check.name}`);
      if (!check.pass) allPassed = false;
    });

    // Verify the item was actually removed
    const getCartResponse = await axios.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const removedItem = getCartResponse.data.data.cart.items.find(item => item.id === itemToRemove.id);
    
    if (!removedItem) {
      console.log('   ✓ Item removed successfully');
    } else {
      console.log('   ✗ Item still exists in cart');
      allPassed = false;
    }

    if (allPassed) {
      console.log('   ✅ PASSED: removeFromCart endpoint works correctly');
      results.passed++;
      results.tests.push({ name: 'removeFromCart Preservation', status: 'PASSED' });
    } else {
      console.log('   ❌ FAILED: removeFromCart endpoint has issues');
      results.failed++;
      results.tests.push({ name: 'removeFromCart Preservation', status: 'FAILED' });
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.response?.data?.message || error.message}`);
    results.failed++;
    results.tests.push({ name: 'removeFromCart Preservation', status: 'FAILED', error: error.message });
  }
}

/**
 * Test 4: clearCart endpoint preservation
 */
async function testClearCart(results) {
  console.log('\n🧪 Test 4: clearCart Endpoint Preservation');
  console.log('-'.repeat(70));

  try {
    const response = await axios.delete(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const checks = [
      { name: 'Response is successful', pass: response.data.success === true },
      { name: 'Message indicates clearing', pass: response.data.message.includes('cleared') || response.data.message.includes('deleted') }
    ];

    let allPassed = true;
    checks.forEach(check => {
      const status = check.pass ? '✓' : '✗';
      console.log(`   ${status} ${check.name}`);
      if (!check.pass) allPassed = false;
    });

    // Verify cart is actually cleared
    try {
      const getCartResponse = await axios.get(`${BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      // Cart might return empty or not found
      if (getCartResponse.data.data.cart === null || 
          (getCartResponse.data.data.cart && getCartResponse.data.data.cart.items.length === 0)) {
        console.log('   ✓ Cart is empty');
      } else {
        console.log('   ✗ Cart still has items');
        allPassed = false;
      }
    } catch (error) {
      // 404 is acceptable for empty cart
      if (error.response?.status === 404) {
        console.log('   ✓ Cart is empty (404 response)');
      } else {
        throw error;
      }
    }

    if (allPassed) {
      console.log('   ✅ PASSED: clearCart endpoint works correctly');
      results.passed++;
      results.tests.push({ name: 'clearCart Preservation', status: 'PASSED' });
    } else {
      console.log('   ❌ FAILED: clearCart endpoint has issues');
      results.failed++;
      results.tests.push({ name: 'clearCart Preservation', status: 'FAILED' });
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.response?.data?.message || error.message}`);
    results.failed++;
    results.tests.push({ name: 'clearCart Preservation', status: 'FAILED', error: error.message });
  }
}

/**
 * Test 5: Error handling preservation
 */
async function testErrorHandling(results) {
  console.log('\n🧪 Test 5: Error Handling Preservation');
  console.log('-'.repeat(70));

  let allPassed = true;

  // Test 5a: Invalid product ID
  try {
    await axios.post(
      `${BASE_URL}/cart/items`,
      { productId: 999999, quantity: 1 },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('   ✗ Should have returned error for invalid product');
    allPassed = false;
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      console.log('   ✓ Invalid product returns appropriate error');
    } else {
      console.log(`   ✗ Unexpected error status: ${error.response?.status}`);
      allPassed = false;
    }
  }

  // Test 5b: Invalid quantity (0)
  try {
    await axios.post(
      `${BASE_URL}/cart/items`,
      { productId: testProductId, quantity: 0 },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('   ✗ Should have returned error for quantity 0');
    allPassed = false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('   ✓ Invalid quantity (0) returns error');
    } else {
      console.log(`   ✗ Unexpected error status for quantity 0: ${error.response?.status}`);
      allPassed = false;
    }
  }

  // Test 5c: Invalid quantity (negative)
  try {
    await axios.post(
      `${BASE_URL}/cart/items`,
      { productId: testProductId, quantity: -1 },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('   ✗ Should have returned error for negative quantity');
    allPassed = false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('   ✓ Invalid quantity (negative) returns error');
    } else {
      console.log(`   ✗ Unexpected error status for negative quantity: ${error.response?.status}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('   ✅ PASSED: Error handling works correctly');
    results.passed++;
    results.tests.push({ name: 'Error Handling Preservation', status: 'PASSED' });
  } else {
    console.log('   ❌ FAILED: Error handling has issues');
    results.failed++;
    results.tests.push({ name: 'Error Handling Preservation', status: 'FAILED' });
  }
}

/**
 * Test 6: Stock validation preservation
 */
async function testStockValidation(results) {
  console.log('\n🧪 Test 6: Stock Validation Preservation');
  console.log('-'.repeat(70));

  try {
    // Get product stock
    const productResponse = await axios.get(`${BASE_URL}/products/${testProductId}`);
    const productStock = productResponse.data.data.product.quantity;

    console.log(`   Product stock: ${productStock}`);

    // Try to add more than available stock
    try {
      await axios.post(
        `${BASE_URL}/cart/items`,
        { productId: testProductId, quantity: productStock + 100 },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      console.log('   ✗ Should have returned error for insufficient stock');
      results.failed++;
      results.tests.push({ name: 'Stock Validation Preservation', status: 'FAILED' });
    } catch (error) {
      if (error.response?.status === 400 && 
          (error.response.data.message.includes('stock') || 
           error.response.data.message.includes('quantity') ||
           error.response.data.message.includes('available'))) {
        console.log('   ✓ Stock validation prevents over-ordering');
        console.log('   ✅ PASSED: Stock validation works correctly');
        results.passed++;
        results.tests.push({ name: 'Stock Validation Preservation', status: 'PASSED' });
      } else {
        console.log(`   ✗ Unexpected error: ${error.response?.data?.message}`);
        results.failed++;
        results.tests.push({ name: 'Stock Validation Preservation', status: 'FAILED' });
      }
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.response?.data?.message || error.message}`);
    results.failed++;
    results.tests.push({ name: 'Stock Validation Preservation', status: 'FAILED', error: error.message });
  }
}

/**
 * Print test summary
 */
function printSummary(results) {
  console.log('\n' + '=' .repeat(70));
  console.log('📊 PRESERVATION TEST SUMMARY\n');
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('\nTest Results:');
  results.tests.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
  console.log('=' .repeat(70));
}

// Run the tests
console.log('Starting Cart Fix Preservation Property Tests...\n');
runPreservationTests();
