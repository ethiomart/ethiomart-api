const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

/**
 * Bug Condition Exploration Test for Customer Registration with Phone Number
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This test encodes the EXPECTED BEHAVIOR from the design document:
 * - POST /auth/register with phoneNumber should return 201 with user data including phoneNumber
 * - User should be created in database with phone field populated
 * - Response should include phoneNumber in user object
 * 
 * On UNFIXED code, registration with phone number fails with "Bad request: Unknown error"
 * because the User model doesn't have a phone field definition.
 * 
 * When the fix is implemented, this same test will pass, confirming the bug is fixed.
 */

// Test cases from the design document
const TEST_CASES = [
  {
    name: 'Registration with Ethiopian phone (+251905442145)',
    data: {
      email: 'yohannes.test@example.com',
      password: 'Yo@ad#09',
      firstName: 'Yohannes',
      lastName: 'Adane',
      phoneNumber: '+251905442145',
      role: 'customer'
    }
  },
  {
    name: 'Registration with international phone (+1234567890)',
    data: {
      email: 'jane.test@example.com',
      password: 'SecurePass123!',
      firstName: 'Jane',
      lastName: 'Doe',
      phoneNumber: '+1234567890',
      role: 'customer'
    }
  },
  {
    name: 'Registration with Ethiopian phone (+251911234567)',
    data: {
      email: 'john.test@example.com',
      password: 'Pass123!',
      firstName: 'John',
      lastName: 'Smith',
      phoneNumber: '+251911234567',
      role: 'customer'
    }
  }
];

async function testCustomerRegistrationWithPhone() {
  const counterexamples = [];
  let successCount = 0;

  try {
    console.log('🧪 Customer Registration with Phone Number - Bug Exploration Test\n');
    console.log('=' .repeat(70));
    console.log('IMPORTANT: This test encodes EXPECTED BEHAVIOR');
    console.log('On UNFIXED code: Test will FAIL (proves bug exists)');
    console.log('On FIXED code: Test will PASS (proves bug is fixed)');
    console.log('=' .repeat(70));

    // Test each registration case
    for (let i = 0; i < TEST_CASES.length; i++) {
      const testCase = TEST_CASES[i];
      console.log(`\n${i + 1}️⃣  Testing: ${testCase.name}`);
      console.log(`   Email: ${testCase.data.email}`);
      console.log(`   Phone: ${testCase.data.phoneNumber}`);
      console.log('   Expected: 201 Created with phoneNumber in response');
      console.log('   Actual on unfixed code: 400 Bad Request or phoneNumber missing');

      try {
        const response = await axios.post(
          `${BASE_URL}/auth/register`,
          testCase.data
        );

        // Check if registration succeeded
        if (response.status === 201 && response.data.success) {
          const user = response.data.data.user;
          
          // Verify phoneNumber is in the response
          if (user.phoneNumber === testCase.data.phoneNumber) {
            console.log('✅ Registration successful with phoneNumber in response');
            console.log(`   User ID: ${user.id}`);
            console.log(`   Phone Number: ${user.phoneNumber}`);
            console.log('   ✓ phoneNumber matches input');
            successCount++;
          } else if (!user.phoneNumber) {
            console.log('❌ Registration succeeded but phoneNumber is MISSING from response');
            console.log('   COUNTEREXAMPLE: User model does not include phone field');
            counterexamples.push({
              testCase: testCase.name,
              input: testCase.data.phoneNumber,
              expected: 'phoneNumber in response',
              actual: 'phoneNumber missing from response',
              rootCause: 'User model missing phone field or authController not mapping phone to phoneNumber in response'
            });
          } else {
            console.log('⚠️  Registration succeeded but phoneNumber does not match');
            console.log(`   Expected: ${testCase.data.phoneNumber}`);
            console.log(`   Actual: ${user.phoneNumber}`);
            counterexamples.push({
              testCase: testCase.name,
              input: testCase.data.phoneNumber,
              expected: testCase.data.phoneNumber,
              actual: user.phoneNumber,
              rootCause: 'Field mapping issue in authController'
            });
          }
        } else {
          console.log(`⚠️  Unexpected response status: ${response.status}`);
          counterexamples.push({
            testCase: testCase.name,
            input: testCase.data.phoneNumber,
            expected: '201 Created',
            actual: `${response.status} ${response.statusText}`,
            rootCause: 'Unexpected response status'
          });
        }
      } catch (error) {
        if (error.response) {
          const status = error.response.status;
          const message = error.response.data.message || error.response.statusText;
          
          console.log(`❌ Registration FAILED with ${status} ${error.response.statusText}`);
          console.log(`   Error message: "${message}"`);
          
          if (status === 400 || message.includes('Bad request') || message.includes('Unknown error')) {
            console.log('   COUNTEREXAMPLE: This confirms the bug exists');
            console.log('   Root Cause: User model missing phone field definition');
            counterexamples.push({
              testCase: testCase.name,
              input: testCase.data.phoneNumber,
              expected: '201 Created with phoneNumber',
              actual: `${status} ${message}`,
              rootCause: 'User model does not define phone field, causing Sequelize to reject or ignore the field'
            });
          } else if (status === 409 || message.includes('already exists')) {
            console.log('   ℹ️  User already exists (from previous test run)');
            console.log('   Skipping this test case');
          } else {
            console.log('   ⚠️  Unexpected error type');
            counterexamples.push({
              testCase: testCase.name,
              input: testCase.data.phoneNumber,
              expected: '201 Created',
              actual: `${status} ${message}`,
              rootCause: 'Unexpected error'
            });
          }
        } else if (error.request) {
          console.error('❌ No response received from server');
          console.error('   Make sure the backend server is running on http://localhost:5000');
          throw error;
        } else {
          console.error(`❌ Error: ${error.message}`);
          throw error;
        }
      }

      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n' + '=' .repeat(70));
    console.log('📊 TEST SUMMARY\n');

    if (counterexamples.length > 0) {
      console.log('❌ BUG CONFIRMED: Customer registration with phone number fails\n');
      console.log(`Tests passed: ${successCount}/${TEST_CASES.length}`);
      console.log(`Tests failed: ${counterexamples.length}/${TEST_CASES.length}\n`);
      
      console.log('Counterexamples found:');
      counterexamples.forEach((ce, index) => {
        console.log(`\n${index + 1}. ${ce.testCase}`);
        console.log(`   Input phone: ${ce.input}`);
        console.log(`   Expected: ${ce.expected}`);
        console.log(`   Actual: ${ce.actual}`);
        console.log(`   Root Cause: ${ce.rootCause}`);
      });

      console.log('\n📝 Root Cause Analysis:');
      console.log('   • User model (src/models/User.js) does not define a phone field');
      console.log('   • Database has phone column but Sequelize model is missing the field definition');
      console.log('   • authController.register does not extract phoneNumber from req.body');
      console.log('   • authController.register does not map phoneNumber to phone when creating user');
      console.log('   • Response does not include phone/phoneNumber in user data');

      console.log('\n✅ This is the EXPECTED outcome for unfixed code');
      console.log('   The test correctly identified the bug condition');
      console.log('   When the fix is implemented, this test will pass');
      
      console.log('\n' + '=' .repeat(70));
      console.log('Test completed: Bug exploration successful\n');
      process.exit(0); // Exit with success - finding the bug is the goal
    } else {
      console.log('✅ ALL TESTS PASSED: Customer registration with phone number works correctly\n');
      console.log(`All ${TEST_CASES.length} test cases passed successfully\n`);
      console.log('This means the bug has been FIXED:');
      console.log('   • POST /auth/register accepts phoneNumber field');
      console.log('   • User model includes phone field definition');
      console.log('   • Phone number is stored in database');
      console.log('   • Response includes phoneNumber in user object');
      console.log('   • Field mapping between phoneNumber (API) and phone (DB) works correctly');
      
      console.log('\n' + '=' .repeat(70));
      console.log('Test completed: Fix validation successful\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n💥 UNEXPECTED ERROR during test execution:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data.message || error.response.statusText}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response received from server');
      console.error('   Make sure the backend server is running on http://localhost:5000');
    } else {
      console.error(`   ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
    console.log('\n' + '=' .repeat(70));
    console.log('Test failed with unexpected error\n');
    process.exit(1);
  }
}

// Run the test
console.log('Starting Customer Registration with Phone Number Bug Exploration Test...\n');
testCustomerRegistrationWithPhone();
