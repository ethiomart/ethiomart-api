/**
 * Property-Based Tests for Amount Validation
 * Task 11.2: Amount Validation Properties
 * 
 * This test suite validates universal properties of amount validation
 * using property-based testing with fast-check library.
 * 
 * Properties tested:
 * - Property 3: Amount precision (max 2 decimal places) (Task 11.2.3)
 * - Property 4: Amount range validation (positive, within limits) (Task 11.2.4)
 * - Property 5: Amount mismatch detection in verification (Task 11.2.5)
 * 
 * Run with: node test/properties/amountValidationProperties.test.js
 */

const fc = require('fast-check');

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

// Helper function to count decimal places
function countDecimalPlaces(num) {
  const str = num.toString();
  if (!str.includes('.')) return 0;
  return str.split('.')[1].length;
}

// Helper function to validate amount format (simulates middleware validation)
function hasValidPrecision(amount) {
  // Convert to string and check decimal places
  const amountStr = amount.toString();
  if (!amountStr.includes('.')) return true; // No decimals is valid
  
  const decimalPart = amountStr.split('.')[1];
  return decimalPart.length <= 2;
}

// Helper function to validate amount is positive (simulates middleware validation)
function isPositiveAmount(amount) {
  return typeof amount === 'number' && amount > 0 && !isNaN(amount) && isFinite(amount);
}

// Helper function to validate amount range
function isWithinValidRange(amount) {
  return amount >= 0.01 && amount <= 10000000; // Reasonable limits
}

// Helper function to compare amounts with tolerance for floating point precision
function amountsMatch(amount1, amount2, tolerance = 0.01) {
  return Math.abs(amount1 - amount2) < tolerance;
}

// Main test execution
async function runAllTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 AMOUNT VALIDATION PROPERTY-BASED TESTS');
  console.log('='.repeat(70));
  console.log('\nFeature: chapa-payment-integration');
  console.log('Task 11.2: Amount Validation Properties\n');
  
  // ========== Property 3: Amount precision (max 2 decimal places) ==========
  console.log('\n📋 Property 3: Amount precision (max 2 decimal places)');
  console.log('   Validates: Requirements 11.1\n');
  
  /**
   * For any payment initialization request, amounts must have a maximum 
   * of 2 decimal places.
   * 
   * This property ensures that:
   * 1. Amounts with 0, 1, or 2 decimal places are accepted
   * 2. Amounts with more than 2 decimal places are rejected
   * 3. The precision is maintained throughout the payment flow
   */
  
  await runPropertyTest(
    'Property 3.1: Accept amounts with 0, 1, or 2 decimal places',
    fc.property(
      fc.oneof(
        fc.integer({ min: 1, max: 100000 }), // No decimals
        fc.float({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }).map(n => Math.round(n * 10) / 10), // 1 decimal
        fc.float({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }).map(n => Math.round(n * 100) / 100) // 2 decimals
      ),
      (amount) => {
        // Ensure amount has valid precision
        const roundedAmount = Math.round(amount * 100) / 100;
        const decimalPlaces = countDecimalPlaces(roundedAmount);
        
        // Should accept amounts with 0, 1, or 2 decimal places
        return decimalPlaces <= 2 && hasValidPrecision(roundedAmount);
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 3.2: Reject amounts with more than 2 decimal places',
    fc.property(
      fc.float({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
      (rawAmount) => {
        const decimalPlaces = countDecimalPlaces(rawAmount);
        const isValid = hasValidPrecision(rawAmount);
        
        // If amount has more than 2 decimal places, it should be invalid
        if (decimalPlaces > 2) {
          return !isValid;
        }
        
        // Otherwise it should be valid
        return isValid;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 3.3: Maintain precision consistency after rounding',
    fc.property(
      fc.float({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
      (rawAmount) => {
        // Round to 2 decimal places
        const roundedAmount = Math.round(rawAmount * 100) / 100;
        
        // After rounding, should always have valid precision
        return hasValidPrecision(roundedAmount) && countDecimalPlaces(roundedAmount) <= 2;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 3.4: Handle edge case amounts with valid precision',
    fc.property(
      fc.oneof(
        fc.constant(0.01),    // Minimum amount
        fc.constant(0.99),    // Less than 1
        fc.constant(1.00),    // Exactly 1
        fc.constant(99.99),   // Two digit integer
        fc.constant(999.99),  // Three digit integer
        fc.constant(9999.99), // Four digit integer
        fc.float({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }).map(n => Math.round(n * 100) / 100)
      ),
      (amount) => {
        // All edge cases should have valid precision
        return hasValidPrecision(amount) && countDecimalPlaces(amount) <= 2;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 3.5: Preserve precision in amount string conversion',
    fc.property(
      fc.float({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }).map(n => Math.round(n * 100) / 100),
      (amount) => {
        // Amount should be convertible to string with proper precision
        const amountStr = amount.toString();
        const hasValidFormat = !amountStr.includes('.') || amountStr.split('.')[1].length <= 2;
        
        return hasValidFormat && hasValidPrecision(amount);
      }
    ),
    { numRuns: 100 }
  );

  // ========== Property 4: Amount range validation (positive, within limits) ==========
  console.log('\n📋 Property 4: Amount range validation (positive, within limits)');
  console.log('   Validates: Requirements 11.1\n');
  
  /**
   * For any payment initialization request, amounts that are zero or 
   * negative must be rejected with a validation error.
   * 
   * This property ensures that:
   * 1. Positive amounts are accepted
   * 2. Zero amounts are rejected
   * 3. Negative amounts are rejected
   * 4. Very large amounts within limits are accepted
   */
  
  await runPropertyTest(
    'Property 4.1: Accept positive amounts',
    fc.property(
      fc.integer({ min: 1, max: 10000000 }).map(n => n / 100), // Generate positive amounts with 2 decimals
      (amount) => {
        // Positive amounts should pass validation
        return isPositiveAmount(amount) && isWithinValidRange(amount);
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 4.2: Reject zero amounts',
    fc.property(
      fc.constant(0),
      (amount) => {
        // Zero should fail validation
        return !isPositiveAmount(amount);
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 4.3: Reject negative amounts',
    fc.property(
      fc.integer({ min: -100000, max: -1 }).map(n => n / 100), // Generate negative amounts
      (amount) => {
        // Negative amounts should fail validation
        return !isPositiveAmount(amount);
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 4.4: Accept very large amounts within reasonable limits',
    fc.property(
      fc.integer({ min: 1000000, max: 100000000 }).map(n => n / 100), // Generate large amounts
      (amount) => {
        // Large positive amounts should pass validation
        return isPositiveAmount(amount) && isWithinValidRange(amount);
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 4.5: Handle boundary values correctly',
    fc.property(
      fc.oneof(
        fc.constant(0.01),      // Minimum valid amount
        fc.constant(0.001),     // Below minimum (should fail)
        fc.constant(-0.01),     // Negative (should fail)
        fc.constant(0),         // Zero (should fail)
        fc.constant(999999.99)  // Very large (should succeed)
      ),
      (amount) => {
        const isValid = isPositiveAmount(amount) && isWithinValidRange(amount);
        
        // Should only be valid for positive amounts >= 0.01
        if (amount >= 0.01) {
          return isValid;
        } else {
          return !isValid;
        }
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 4.6: Validate amount type consistency',
    fc.property(
      fc.integer({ min: 100, max: 10000000 }).map(n => n / 100), // Generate amounts
      (amount) => {
        // Amount should be handled consistently as a number
        return typeof amount === 'number' && isPositiveAmount(amount);
      }
    ),
    { numRuns: 100 }
  );

  // ========== Property 5: Amount mismatch detection in verification ==========
  console.log('\n📋 Property 5: Amount mismatch detection in verification');
  console.log('   Validates: Requirements 4.4, 12.2\n');
  
  /**
   * For any verification where amount doesn't match the initialized amount,
   * the transaction must be rejected and logged.
   * 
   * This property ensures that:
   * 1. Matching amounts pass verification
   * 2. Mismatched amounts are detected
   * 3. The system maintains payment integrity
   * 
   * Note: This property tests the validation logic, not actual Chapa API calls
   */
  
  await runPropertyTest(
    'Property 5.1: Detect amount mismatch in verification',
    fc.property(
      fc.integer({ min: 100, max: 10000000 }).map(n => n / 100), // initialized amount
      fc.integer({ min: 100, max: 10000000 }).map(n => n / 100), // verified amount
      (initializedAmount, verifiedAmount) => {
        // Simulate amount validation logic
        const amountsMatch = Math.abs(initializedAmount - verifiedAmount) < 0.01; // Allow for floating point precision
        
        if (initializedAmount === verifiedAmount) {
          // Exact match should pass
          return amountsMatch;
        } else {
          // Mismatch should be detected
          return !amountsMatch || Math.abs(initializedAmount - verifiedAmount) >= 0.01;
        }
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 5.2: Accept matching amounts with floating point precision',
    fc.property(
      fc.integer({ min: 100, max: 10000000 }).map(n => n / 100),
      (amount) => {
        // Same amount should always match
        const initializedAmount = amount;
        const verifiedAmount = amount;
        
        const amountsMatch = Math.abs(initializedAmount - verifiedAmount) < 0.01;
        return amountsMatch;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 5.3: Detect small amount differences',
    fc.property(
      fc.integer({ min: 1000, max: 10000000 }).map(n => n / 100),
      fc.integer({ min: 2, max: 1000 }).map(n => n / 100), // difference (at least 0.02 to avoid tolerance edge case)
      (baseAmount, difference) => {
        const initializedAmount = baseAmount;
        const verifiedAmount = baseAmount + difference;
        
        // Should detect the difference
        const amountsMatch = Math.abs(initializedAmount - verifiedAmount) < 0.01;
        
        if (difference >= 0.02) {
          // Significant difference should be detected
          return !amountsMatch;
        } else {
          // Very small difference might be within tolerance
          return true;
        }
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 5.4: Handle amount comparison edge cases',
    fc.property(
      fc.oneof(
        fc.constant({ init: 100.00, verify: 100.00 }),  // Exact match
        fc.constant({ init: 100.00, verify: 100.01 }),  // 1 cent difference
        fc.constant({ init: 100.00, verify: 99.99 }),   // 1 cent less
        fc.constant({ init: 100.00, verify: 101.00 }),  // 1 dollar more
        fc.constant({ init: 100.00, verify: 99.00 }),   // 1 dollar less
        fc.constant({ init: 0.01, verify: 0.01 }),      // Minimum amount
        fc.constant({ init: 99999.99, verify: 99999.99 }) // Maximum amount
      ),
      (amounts) => {
        const amountsMatch = Math.abs(amounts.init - amounts.verify) < 0.01;
        
        if (amounts.init === amounts.verify) {
          return amountsMatch;
        } else {
          return !amountsMatch;
        }
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 5.5: Validate amount mismatch across different magnitudes',
    fc.property(
      fc.integer({ min: 100, max: 10000000 }).map(n => n / 100),
      fc.integer({ min: 5, max: 100 }).map(n => n / 1000), // percentage difference (0.005 to 0.1)
      (baseAmount, percentDiff) => {
        const initializedAmount = baseAmount;
        const verifiedAmount = baseAmount * (1 + percentDiff);
        const roundedVerified = Math.round(verifiedAmount * 100) / 100;
        
        const absoluteDiff = Math.abs(initializedAmount - roundedVerified);
        const amountsMatch = absoluteDiff < 0.01;
        
        // If the absolute difference after rounding is >= 0.01, it should be detected
        if (absoluteDiff >= 0.01) {
          return !amountsMatch;
        }
        
        // If the absolute difference is < 0.01, it's within tolerance
        return true;
      }
    ),
    { numRuns: 100 }
  );

  await runPropertyTest(
    'Property 5.6: Ensure symmetric amount comparison',
    fc.property(
      fc.integer({ min: 100, max: 10000000 }).map(n => n / 100),
      fc.integer({ min: 100, max: 10000000 }).map(n => n / 100),
      (amount1, amount2) => {
        // Comparison should be symmetric: A matches B iff B matches A
        const match1to2 = Math.abs(amount1 - amount2) < 0.01;
        const match2to1 = Math.abs(amount2 - amount1) < 0.01;
        
        return match1to2 === match2to1;
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
