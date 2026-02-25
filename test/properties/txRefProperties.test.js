/**
 * Property-Based Tests for Transaction Reference Generation
 * Task 11.1: Transaction Reference Properties
 * 
 * This test suite validates universal properties of tx_ref generation
 * using property-based testing with fast-check library.
 * 
 * Properties tested:
 * - Property 1: Unique tx_ref generation for all order IDs (Task 11.1.1)
 * - Property 2: tx_ref format validation (Task 11.1.2)
 * 
 * Run with: node test/properties/txRefProperties.test.js
 */

const fc = require('fast-check');
const chapaService = require('../../src/services/chapaService');

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Helper function to run property tests
async function runPropertyTest(testName, propertyFn, options = {}) {
  testResults.total++;
  console.log(`\n🧪 Running: ${testName}`);
  
  try {
    await fc.assert(propertyFn, {
      numRuns: options.numRuns || 100,
      verbose: options.verbose || false,
      ...options
    });
    
    testResults.passed++;
    testResults.details.push({ name: testName, status: 'PASSED' });
    console.log(`✅ PASSED: ${testName}`);
    return true;
  } catch (error) {
    testResults.failed++;
    testResults.details.push({ 
      name: testName, 
      status: 'FAILED', 
      error: error.message,
      counterexample: error.counterexample
    });
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}`);
    if (error.counterexample) {
      console.log(`   Counterexample: ${JSON.stringify(error.counterexample)}`);
    }
    return false;
  }
}

// Main test execution
async function runAllTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TRANSACTION REFERENCE PROPERTY-BASED TESTS');
  console.log('='.repeat(70));
  console.log('\nFeature: chapa-payment-integration');
  console.log('Task 11.1: Transaction Reference Properties\n');
  
  // ========== Property 1: Unique tx_ref generation for all order IDs ==========
  console.log('\n📋 Property 1: Unique tx_ref generation for all order IDs');
  console.log('   Validates: Requirements 1.1\n');
  
  /**
   * For any set of payment initializations, all generated transaction 
   * references (tx_ref) must be unique and follow the format 
   * "order-{orderId}-{timestamp}".
   * 
   * This property ensures that:
   * 1. No two tx_refs are identical across different order IDs
   * 2. No two tx_refs are identical even for the same order ID
   * 3. The uniqueness holds across large sets of transactions
   */
  
  await runPropertyTest(
    'Property 1.1: Generate unique tx_refs for different order IDs',
    fc.asyncProperty(
      // Generate array of unique order IDs (10-100 items, range 1-10000)
      fc.array(
        fc.integer({ min: 1, max: 10000 }),
        { minLength: 10, maxLength: 100 }
      ),
      async (orderIds) => {
        const txRefs = [];
        
        // Generate tx_ref for each order ID
        for (const orderId of orderIds) {
          const result = await chapaService.initializePayment(
            orderId,
            1000,
            'test@example.com',
            'John',
            'Doe'
          );
          txRefs.push(result.reference);
        }
        
        // Check uniqueness: all tx_refs should be unique
        const uniqueRefs = new Set(txRefs);
        return txRefs.length === uniqueRefs.size;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 1.2: Generate unique tx_refs for same order ID called multiple times',
    fc.asyncProperty(
      // Generate a single order ID and number of calls
      fc.integer({ min: 1, max: 10000 }),
      fc.integer({ min: 10, max: 50 }),
      async (orderId, numCalls) => {
        const txRefs = [];
        
        // Generate multiple tx_refs for the same order ID
        for (let i = 0; i < numCalls; i++) {
          const result = await chapaService.initializePayment(
            orderId,
            1000,
            'test@example.com',
            'John',
            'Doe'
          );
          txRefs.push(result.reference);
          
          // Small delay to ensure different timestamps
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        // Check uniqueness: all tx_refs should be unique
        const uniqueRefs = new Set(txRefs);
        return txRefs.length === uniqueRefs.size;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 1.3: Generate unique tx_refs across mixed order IDs with duplicates',
    fc.asyncProperty(
      // Generate array that may contain duplicate order IDs
      fc.array(
        fc.integer({ min: 1, max: 100 }),
        { minLength: 20, maxLength: 100 }
      ),
      async (orderIds) => {
        const txRefs = [];
        
        // Generate tx_ref for each order ID (including duplicates)
        for (const orderId of orderIds) {
          const result = await chapaService.initializePayment(
            orderId,
            1000,
            'test@example.com',
            'John',
            'Doe'
          );
          txRefs.push(result.reference);
          
          // Small delay to ensure different timestamps
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        // Check uniqueness: all tx_refs should be unique even with duplicate order IDs
        const uniqueRefs = new Set(txRefs);
        return txRefs.length === uniqueRefs.size;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 1.4: Generate unique tx_refs with varying amounts and customer data',
    fc.asyncProperty(
      // Generate array of order data with varying parameters
      fc.array(
        fc.record({
          orderId: fc.integer({ min: 1, max: 10000 }),
          amount: fc.float({ min: 1, max: 100000, noNaN: true }),
          email: fc.emailAddress(),
          firstName: fc.string({ minLength: 1, maxLength: 50 }),
          lastName: fc.string({ minLength: 1, maxLength: 50 })
        }),
        { minLength: 10, maxLength: 50 }
      ),
      async (orders) => {
        const txRefs = [];
        
        // Generate tx_ref for each order with varying data
        for (const order of orders) {
          const result = await chapaService.initializePayment(
            order.orderId,
            order.amount,
            order.email,
            order.firstName,
            order.lastName
          );
          txRefs.push(result.reference);
          
          // Small delay to ensure different timestamps
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        // Check uniqueness: tx_refs should be unique regardless of other parameters
        const uniqueRefs = new Set(txRefs);
        return txRefs.length === uniqueRefs.size;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 1.5: Maintain uniqueness under concurrent generation',
    fc.asyncProperty(
      // Generate array of order IDs for concurrent processing
      fc.array(
        fc.integer({ min: 1, max: 10000 }),
        { minLength: 10, maxLength: 30 }
      ),
      async (orderIds) => {
        // Generate tx_refs concurrently
        const promises = orderIds.map(orderId =>
          chapaService.initializePayment(
            orderId,
            1000,
            'test@example.com',
            'John',
            'Doe'
          )
        );
        
        const results = await Promise.all(promises);
        const txRefs = results.map(r => r.reference);
        
        // Check uniqueness: all tx_refs should be unique even when generated concurrently
        const uniqueRefs = new Set(txRefs);
        return txRefs.length === uniqueRefs.size;
      }
    ),
    { numRuns: 100 }
  );

  // ========== Property 2: tx_ref format validation ==========
  console.log('\n📋 Property 2: tx_ref format validation (order-{orderId}-{timestamp})');
  console.log('   Validates: Requirements 1.1\n');
  
  /**
   * For any payment initialization, the generated tx_ref must follow
   * the exact format: "order-{orderId}-{timestamp}"
   * 
   * This property ensures that:
   * 1. The format is consistent across all order IDs
   * 2. The orderId is correctly embedded in the reference
   * 3. The timestamp is valid and recent
   * 4. The format is parseable and predictable
   */
  
  await runPropertyTest(
    'Property 2.1: Follow format order-{orderId}-{timestamp} for all order IDs',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 1000000 }),
      async (orderId) => {
        const result = await chapaService.initializePayment(
          orderId,
          1000,
          'test@example.com',
          'John',
          'Doe'
        );
        
        const txRef = result.reference;
        
        // Check format: should match pattern order-{orderId}-{timestamp}
        const pattern = new RegExp(`^order-${orderId}-\\d+$`);
        return pattern.test(txRef);
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 2.2: Contain valid timestamp in tx_ref',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 10000 }),
      async (orderId) => {
        const beforeTime = Date.now();
        
        const result = await chapaService.initializePayment(
          orderId,
          1000,
          'test@example.com',
          'John',
          'Doe'
        );
        
        const afterTime = Date.now();
        const txRef = result.reference;
        
        // Extract timestamp from tx_ref
        const parts = txRef.split('-');
        if (parts.length !== 3) return false;
        
        const timestamp = parseInt(parts[2]);
        
        // Timestamp should be a valid number
        if (isNaN(timestamp)) return false;
        
        // Timestamp should be between before and after time (with small buffer)
        return timestamp >= beforeTime - 1000 && timestamp <= afterTime + 1000;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 2.3: Have exactly 3 parts separated by hyphens',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 10000 }),
      async (orderId) => {
        const result = await chapaService.initializePayment(
          orderId,
          1000,
          'test@example.com',
          'John',
          'Doe'
        );
        
        const txRef = result.reference;
        const parts = txRef.split('-');
        
        // Should have exactly 3 parts: "order", orderId, timestamp
        if (parts.length !== 3) return false;
        
        // First part should be "order"
        if (parts[0] !== 'order') return false;
        
        // Second part should be the orderId
        if (parts[1] !== orderId.toString()) return false;
        
        // Third part should be a valid timestamp (numeric)
        if (!/^\d+$/.test(parts[2])) return false;
        
        return true;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 2.4: Maintain format consistency across different parameter combinations',
    fc.asyncProperty(
      fc.record({
        orderId: fc.integer({ min: 1, max: 10000 }),
        amount: fc.float({ min: 1, max: 100000, noNaN: true }),
        email: fc.emailAddress(),
        firstName: fc.string({ minLength: 1, maxLength: 50 }),
        lastName: fc.string({ minLength: 1, maxLength: 50 }),
        phoneNumber: fc.option(fc.string({ minLength: 10, maxLength: 15 }), { nil: null })
      }),
      async (params) => {
        const result = await chapaService.initializePayment(
          params.orderId,
          params.amount,
          params.email,
          params.firstName,
          params.lastName,
          params.phoneNumber
        );
        
        const txRef = result.reference;
        
        // Check format regardless of other parameters
        const pattern = new RegExp(`^order-${params.orderId}-\\d+$`);
        return pattern.test(txRef);
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 2.5: Generate parseable tx_refs that can extract orderId',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 10000 }),
      async (orderId) => {
        const result = await chapaService.initializePayment(
          orderId,
          1000,
          'test@example.com',
          'John',
          'Doe'
        );
        
        const txRef = result.reference;
        
        // Extract orderId from tx_ref
        const parts = txRef.split('-');
        const extractedOrderId = parseInt(parts[1]);
        
        // Extracted orderId should match original
        return extractedOrderId === orderId;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 2.6: Handle edge case order IDs correctly',
    fc.asyncProperty(
      fc.oneof(
        fc.constant(1),           // Minimum order ID
        fc.constant(999999999),   // Large order ID
        fc.integer({ min: 1, max: 1000000 })  // Random order ID
      ),
      async (orderId) => {
        const result = await chapaService.initializePayment(
          orderId,
          1000,
          'test@example.com',
          'John',
          'Doe'
        );
        
        const txRef = result.reference;
        
        // Check format for edge cases
        const pattern = new RegExp(`^order-${orderId}-\\d+$`);
        return pattern.test(txRef);
      }
    ),
    { numRuns: 100 }
  );

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
  console.log('='.repeat(70) + '\n');

  if (testResults.failed > 0) {
    console.log('❌ FAILED TESTS:');
    testResults.details
      .filter(t => t.status === 'FAILED')
      .forEach(t => {
        console.log(`  - ${t.name}`);
        console.log(`    Error: ${t.error}`);
        if (t.counterexample) {
          console.log(`    Counterexample: ${JSON.stringify(t.counterexample)}`);
        }
      });
    console.log('');
  }

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
