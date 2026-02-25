/**
 * Payment System Performance Tests
 * 
 * Tests performance requirements for the Chapa payment integration:
 * - Payment initialization response time (< 2 seconds)
 * - Concurrent payment requests handling
 * - Webhook processing under load
 * - Database query performance
 * 
 * Task 19.2: Performance Testing
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const API_ENDPOINT = `${BASE_URL}/api/payments`;
const WEBHOOK_ENDPOINT = `${BASE_URL}/api/payments/webhook`;

// Test configuration
const PERFORMANCE_THRESHOLD = {
  PAYMENT_INIT_MAX_TIME: 2000, // 2 seconds max for payment initialization
  WEBHOOK_MAX_TIME: 500, // 500ms max for webhook processing
  DB_QUERY_MAX_TIME: 100, // 100ms max for database queries
  CONCURRENT_REQUESTS: 10, // Number of concurrent requests to test
  LOAD_TEST_REQUESTS: 50 // Number of requests for load testing
};

// Test results storage
const testResults = {
  paymentInitialization: [],
  concurrentRequests: [],
  webhookProcessing: [],
  databaseQueries: []
};

/**
 * Helper function to measure execution time
 */
async function measureTime(fn, label) {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`  ✓ ${label}: ${duration.toFixed(2)}ms`);
    return { success: true, duration, result };
  } catch (error) {
    const duration = performance.now() - start;
    console.log(`  ✗ ${label}: ${duration.toFixed(2)}ms (Error: ${error.message})`);
    return { success: false, duration, error: error.message };
  }
}

/**
 * Helper function to create test order
 */
async function createTestOrder(token) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/orders`,
      {
        items: [
          {
            productId: 1,
            quantity: 1,
            price: 100.00
          }
        ],
        shippingAddressId: 1,
        shippingMethod: 'standard',
        shippingCost: 10.00
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.data.order.id;
  } catch (error) {
    console.error('Failed to create test order:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Helper function to get authentication token
 */
async function getAuthToken() {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'customer@example.com',
      password: 'password123'
    });
    return response.data.token;
  } catch (error) {
    console.error('Failed to authenticate:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Task 19.2.1: Test payment initialization response time
 * Requirement: Payment initialization should complete in < 2 seconds
 */
async function testPaymentInitializationResponseTime() {
  console.log('\n📊 Task 19.2.1: Testing Payment Initialization Response Time');
  console.log('=' .repeat(70));
  
  const token = await getAuthToken();
  const iterations = 10;
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const orderId = await createTestOrder(token);
    
    const result = await measureTime(async () => {
      const response = await axios.post(
        `${API_ENDPOINT}/initiate`,
        {
          orderId: orderId,
          amount: 110.00,
          email: 'customer@example.com',
          firstName: 'Test',
          lastName: 'Customer'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    }, `Payment initialization #${i + 1}`);
    
    results.push(result);
    testResults.paymentInitialization.push(result);
  }
  
  // Calculate statistics
  const successfulResults = results.filter(r => r.success);
  const durations = successfulResults.map(r => r.duration);
  const avgTime = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxTime = Math.max(...durations);
  const minTime = Math.min(...durations);
  
  console.log('\n📈 Results:');
  console.log(`  Average response time: ${avgTime.toFixed(2)}ms`);
  console.log(`  Min response time: ${minTime.toFixed(2)}ms`);
  console.log(`  Max response time: ${maxTime.toFixed(2)}ms`);
  console.log(`  Success rate: ${successfulResults.length}/${iterations} (${(successfulResults.length/iterations*100).toFixed(1)}%)`);
  
  // Check against threshold
  const passed = maxTime < PERFORMANCE_THRESHOLD.PAYMENT_INIT_MAX_TIME;
  console.log(`\n${passed ? '✅' : '❌'} Performance threshold: ${PERFORMANCE_THRESHOLD.PAYMENT_INIT_MAX_TIME}ms`);
  console.log(`  Status: ${passed ? 'PASSED' : 'FAILED'} (Max: ${maxTime.toFixed(2)}ms)`);
  
  return {
    passed,
    avgTime,
    maxTime,
    minTime,
    successRate: successfulResults.length / iterations
  };
}

/**
 * Task 19.2.2: Test concurrent payment requests
 * Requirement: System should handle multiple simultaneous payment requests
 */
async function testConcurrentPaymentRequests() {
  console.log('\n📊 Task 19.2.2: Testing Concurrent Payment Requests');
  console.log('=' .repeat(70));
  
  const token = await getAuthToken();
  const concurrentCount = PERFORMANCE_THRESHOLD.CONCURRENT_REQUESTS;
  
  // Create orders for concurrent requests
  console.log(`\nCreating ${concurrentCount} test orders...`);
  const orderIds = [];
  for (let i = 0; i < concurrentCount; i++) {
    const orderId = await createTestOrder(token);
    orderIds.push(orderId);
  }
  
  console.log(`\nSending ${concurrentCount} concurrent payment initialization requests...`);
  const start = performance.now();
  
  const promises = orderIds.map((orderId, index) => 
    measureTime(async () => {
      const response = await axios.post(
        `${API_ENDPOINT}/initiate`,
        {
          orderId: orderId,
          amount: 110.00,
          email: `customer${index}@example.com`,
          firstName: 'Test',
          lastName: `Customer${index}`
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );
      return response.data;
    }, `Concurrent request #${index + 1}`)
  );
  
  const results = await Promise.all(promises);
  const totalTime = performance.now() - start;
  
  testResults.concurrentRequests = results;
  
  // Calculate statistics
  const successfulResults = results.filter(r => r.success);
  const durations = successfulResults.map(r => r.duration);
  const avgTime = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxTime = Math.max(...durations);
  const minTime = Math.min(...durations);
  
  console.log('\n📈 Results:');
  console.log(`  Total time for ${concurrentCount} concurrent requests: ${totalTime.toFixed(2)}ms`);
  console.log(`  Average individual response time: ${avgTime.toFixed(2)}ms`);
  console.log(`  Min response time: ${minTime.toFixed(2)}ms`);
  console.log(`  Max response time: ${maxTime.toFixed(2)}ms`);
  console.log(`  Success rate: ${successfulResults.length}/${concurrentCount} (${(successfulResults.length/concurrentCount*100).toFixed(1)}%)`);
  console.log(`  Throughput: ${(concurrentCount / (totalTime / 1000)).toFixed(2)} requests/second`);
  
  // Check if all requests completed successfully
  const passed = successfulResults.length === concurrentCount && maxTime < PERFORMANCE_THRESHOLD.PAYMENT_INIT_MAX_TIME * 2;
  console.log(`\n${passed ? '✅' : '❌'} Concurrent request handling`);
  console.log(`  Status: ${passed ? 'PASSED' : 'FAILED'}`);
  
  return {
    passed,
    totalTime,
    avgTime,
    maxTime,
    minTime,
    successRate: successfulResults.length / concurrentCount,
    throughput: concurrentCount / (totalTime / 1000)
  };
}

/**
 * Task 19.2.3: Test webhook processing under load
 * Requirement: Webhook endpoint should handle multiple callbacks efficiently
 */
async function testWebhookProcessingUnderLoad() {
  console.log('\n📊 Task 19.2.3: Testing Webhook Processing Under Load');
  console.log('=' .repeat(70));
  
  const webhookCount = PERFORMANCE_THRESHOLD.LOAD_TEST_REQUESTS;
  
  console.log(`\nSending ${webhookCount} webhook requests...`);
  const start = performance.now();
  
  const promises = [];
  for (let i = 0; i < webhookCount; i++) {
    const promise = measureTime(async () => {
      const response = await axios.post(
        WEBHOOK_ENDPOINT,
        {
          tx_ref: `test-ref-${Date.now()}-${i}`,
          status: 'success',
          amount: '110.00',
          currency: 'ETB',
          ref_id: `chapa-ref-${i}`
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'chapa-signature': 'test-signature'
          },
          timeout: 5000
        }
      );
      return response.data;
    }, `Webhook #${i + 1}`);
    
    promises.push(promise);
    
    // Add small delay to simulate realistic webhook delivery
    if (i % 10 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const results = await Promise.all(promises);
  const totalTime = performance.now() - start;
  
  testResults.webhookProcessing = results;
  
  // Calculate statistics
  const successfulResults = results.filter(r => r.success);
  const durations = successfulResults.map(r => r.duration);
  const avgTime = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxTime = Math.max(...durations);
  const minTime = Math.min(...durations);
  
  console.log('\n📈 Results:');
  console.log(`  Total time for ${webhookCount} webhooks: ${totalTime.toFixed(2)}ms`);
  console.log(`  Average webhook processing time: ${avgTime.toFixed(2)}ms`);
  console.log(`  Min processing time: ${minTime.toFixed(2)}ms`);
  console.log(`  Max processing time: ${maxTime.toFixed(2)}ms`);
  console.log(`  Success rate: ${successfulResults.length}/${webhookCount} (${(successfulResults.length/webhookCount*100).toFixed(1)}%)`);
  console.log(`  Throughput: ${(webhookCount / (totalTime / 1000)).toFixed(2)} webhooks/second`);
  
  // Check against threshold
  const passed = avgTime < PERFORMANCE_THRESHOLD.WEBHOOK_MAX_TIME && successfulResults.length >= webhookCount * 0.95;
  console.log(`\n${passed ? '✅' : '❌'} Performance threshold: ${PERFORMANCE_THRESHOLD.WEBHOOK_MAX_TIME}ms average`);
  console.log(`  Status: ${passed ? 'PASSED' : 'FAILED'} (Avg: ${avgTime.toFixed(2)}ms)`);
  
  return {
    passed,
    totalTime,
    avgTime,
    maxTime,
    minTime,
    successRate: successfulResults.length / webhookCount,
    throughput: webhookCount / (totalTime / 1000)
  };
}

/**
 * Task 19.2.4: Test database query performance
 * Requirement: Payment lookups should be fast (< 100ms)
 */
async function testDatabaseQueryPerformance() {
  console.log('\n📊 Task 19.2.4: Testing Database Query Performance');
  console.log('=' .repeat(70));
  
  const token = await getAuthToken();
  
  // First, create a payment to query
  console.log('\nCreating test payment...');
  const orderId = await createTestOrder(token);
  const initResponse = await axios.post(
    `${API_ENDPOINT}/initiate`,
    {
      orderId: orderId,
      amount: 110.00,
      email: 'customer@example.com',
      firstName: 'Test',
      lastName: 'Customer'
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const reference = initResponse.data.data.reference;
  console.log(`Payment reference: ${reference}`);
  
  // Test payment verification query performance
  console.log('\nTesting payment verification queries...');
  const iterations = 20;
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const result = await measureTime(async () => {
      const response = await axios.get(
        `${API_ENDPOINT}/verify/${reference}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      return response.data;
    }, `Query #${i + 1}`);
    
    results.push(result);
  }
  
  testResults.databaseQueries = results;
  
  // Calculate statistics
  const successfulResults = results.filter(r => r.success);
  const durations = successfulResults.map(r => r.duration);
  const avgTime = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxTime = Math.max(...durations);
  const minTime = Math.min(...durations);
  const p95Time = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
  
  console.log('\n📈 Results:');
  console.log(`  Average query time: ${avgTime.toFixed(2)}ms`);
  console.log(`  Min query time: ${minTime.toFixed(2)}ms`);
  console.log(`  Max query time: ${maxTime.toFixed(2)}ms`);
  console.log(`  P95 query time: ${p95Time.toFixed(2)}ms`);
  console.log(`  Success rate: ${successfulResults.length}/${iterations} (${(successfulResults.length/iterations*100).toFixed(1)}%)`);
  
  // Check against threshold
  const passed = p95Time < PERFORMANCE_THRESHOLD.DB_QUERY_MAX_TIME;
  console.log(`\n${passed ? '✅' : '❌'} Performance threshold: ${PERFORMANCE_THRESHOLD.DB_QUERY_MAX_TIME}ms (P95)`);
  console.log(`  Status: ${passed ? 'PASSED' : 'FAILED'} (P95: ${p95Time.toFixed(2)}ms)`);
  
  return {
    passed,
    avgTime,
    maxTime,
    minTime,
    p95Time,
    successRate: successfulResults.length / iterations
  };
}

/**
 * Generate performance report
 */
function generatePerformanceReport(results) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(70));
  
  const allPassed = Object.values(results).every(r => r.passed);
  
  console.log('\n🎯 Test Results:');
  console.log(`  19.2.1 Payment Initialization: ${results.paymentInit.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`    - Avg: ${results.paymentInit.avgTime.toFixed(2)}ms, Max: ${results.paymentInit.maxTime.toFixed(2)}ms`);
  console.log(`    - Success Rate: ${(results.paymentInit.successRate * 100).toFixed(1)}%`);
  
  console.log(`\n  19.2.2 Concurrent Requests: ${results.concurrent.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`    - Total: ${results.concurrent.totalTime.toFixed(2)}ms, Avg: ${results.concurrent.avgTime.toFixed(2)}ms`);
  console.log(`    - Throughput: ${results.concurrent.throughput.toFixed(2)} req/s`);
  console.log(`    - Success Rate: ${(results.concurrent.successRate * 100).toFixed(1)}%`);
  
  console.log(`\n  19.2.3 Webhook Processing: ${results.webhook.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`    - Avg: ${results.webhook.avgTime.toFixed(2)}ms, Max: ${results.webhook.maxTime.toFixed(2)}ms`);
  console.log(`    - Throughput: ${results.webhook.throughput.toFixed(2)} webhooks/s`);
  console.log(`    - Success Rate: ${(results.webhook.successRate * 100).toFixed(1)}%`);
  
  console.log(`\n  19.2.4 Database Queries: ${results.dbQuery.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`    - Avg: ${results.dbQuery.avgTime.toFixed(2)}ms, P95: ${results.dbQuery.p95Time.toFixed(2)}ms`);
  console.log(`    - Success Rate: ${(results.dbQuery.successRate * 100).toFixed(1)}%`);
  
  console.log('\n' + '='.repeat(70));
  console.log(`${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('='.repeat(70) + '\n');
  
  return allPassed;
}

/**
 * Main test runner
 */
async function runPerformanceTests() {
  console.log('\n🚀 Starting Payment System Performance Tests');
  console.log('='.repeat(70));
  console.log(`API URL: ${BASE_URL}`);
  console.log(`Test Configuration:`);
  console.log(`  - Payment Init Max Time: ${PERFORMANCE_THRESHOLD.PAYMENT_INIT_MAX_TIME}ms`);
  console.log(`  - Webhook Max Time: ${PERFORMANCE_THRESHOLD.WEBHOOK_MAX_TIME}ms`);
  console.log(`  - DB Query Max Time: ${PERFORMANCE_THRESHOLD.DB_QUERY_MAX_TIME}ms`);
  console.log(`  - Concurrent Requests: ${PERFORMANCE_THRESHOLD.CONCURRENT_REQUESTS}`);
  console.log(`  - Load Test Requests: ${PERFORMANCE_THRESHOLD.LOAD_TEST_REQUESTS}`);
  
  try {
    // Run all performance tests
    const paymentInitResult = await testPaymentInitializationResponseTime();
    const concurrentResult = await testConcurrentPaymentRequests();
    const webhookResult = await testWebhookProcessingUnderLoad();
    const dbQueryResult = await testDatabaseQueryPerformance();
    
    // Generate summary report
    const allPassed = generatePerformanceReport({
      paymentInit: paymentInitResult,
      concurrent: concurrentResult,
      webhook: webhookResult,
      dbQuery: dbQueryResult
    });
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Performance tests failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runPerformanceTests();
}

module.exports = {
  testPaymentInitializationResponseTime,
  testConcurrentPaymentRequests,
  testWebhookProcessingUnderLoad,
  testDatabaseQueryPerformance,
  runPerformanceTests
};
