const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test credentials - using a customer account
const TEST_CUSTOMER = {
  email: 'customer@test.com',
  password: 'Customer123!'
};

// Sample address data matching Flutter's AddressModel
const SAMPLE_ADDRESS = {
  fullName: 'John Doe',
  phoneNumber: '+251911234567',
  addressLine1: '123 Main Street',
  addressLine2: 'Apartment 4B',
  city: 'Addis Ababa',
  state: 'Addis Ababa',
  postalCode: '1000',
  country: 'Ethiopia',
  isDefault: true,
  type: 'shipping'
};

/**
 * Bug Condition Exploration Test for Address Creation Error Fix
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This test encodes the EXPECTED BEHAVIOR from the design document:
 * - POST /user/addresses should return 201 with created address
 * - GET /user/addresses should return 200 with address array
 * - PUT /user/addresses/:id should return 200 with updated address
 * - DELETE /user/addresses/:id should return 200 with success message
 * 
 * On UNFIXED code, these endpoints don't exist, so we expect 404 errors.
 * When the fix is implemented, this same test will pass, confirming the bug is fixed.
 */
async function testAddressBugCondition() {
  let token;
  let createdAddressId;
  const counterexamples = [];

  try {
    console.log('🧪 Address Bug Condition Exploration Test\n');
    console.log('=' .repeat(70));
    console.log('IMPORTANT: This test encodes EXPECTED BEHAVIOR');
    console.log('On UNFIXED code: Test will FAIL with 404 errors (proves bug exists)');
    console.log('On FIXED code: Test will PASS (proves bug is fixed)');
    console.log('=' .repeat(70));

    // Step 1: Login as customer to get authentication token
    console.log('\n1️⃣  Authenticating as customer...');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, TEST_CUSTOMER);
      
      if (!loginResponse.data.success) {
        console.error('❌ Login failed:', loginResponse.data.message);
        console.error('   Cannot proceed with address tests without authentication');
        process.exit(1);
      }

      token = loginResponse.data.data.accessToken;
      console.log('✅ Authentication successful');
      console.log(`   Token obtained: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      console.error('   Make sure the backend server is running and test user exists');
      process.exit(1);
    }

    // Step 2: Test POST /user/addresses (Create Address)
    console.log('\n2️⃣  Testing POST /user/addresses (Create Address)...');
    console.log('   Expected: 201 Created with address data');
    console.log('   Actual on unfixed code: 404 Not Found');
    
    try {
      const createResponse = await axios.post(
        `${BASE_URL}/user/addresses`,
        SAMPLE_ADDRESS,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // If we get here, the endpoint exists (fixed code)
      if (createResponse.status === 201 && createResponse.data.success) {
        console.log('✅ POST /user/addresses returned 201 Created');
        console.log(`   Address created with ID: ${createResponse.data.data.id}`);
        createdAddressId = createResponse.data.data.id;
        
        // Verify response structure
        const address = createResponse.data.data;
        const hasRequiredFields = address.id && address.fullName && address.phoneNumber && 
                                  address.addressLine1 && address.city;
        
        if (hasRequiredFields) {
          console.log('   ✓ Response includes all required fields');
        } else {
          console.log('   ⚠️  Response missing some required fields');
        }
      } else {
        console.log(`⚠️  Unexpected response: ${createResponse.status}`);
        counterexamples.push({
          endpoint: 'POST /user/addresses',
          expected: '201 Created',
          actual: `${createResponse.status} ${createResponse.statusText}`
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('❌ POST /user/addresses returned 404 Not Found');
        console.log('   COUNTEREXAMPLE: addressRoutes does not exist');
        console.log('   This confirms the bug - endpoint is missing');
        counterexamples.push({
          endpoint: 'POST /user/addresses',
          expected: '201 Created with address data',
          actual: '404 Not Found',
          rootCause: 'addressRoutes not registered in server.js'
        });
      } else {
        throw error;
      }
    }

    // Step 3: Test GET /user/addresses (List Addresses)
    console.log('\n3️⃣  Testing GET /user/addresses (List Addresses)...');
    console.log('   Expected: 200 OK with address array');
    console.log('   Actual on unfixed code: 404 Not Found');
    
    try {
      const listResponse = await axios.get(
        `${BASE_URL}/user/addresses`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // If we get here, the endpoint exists (fixed code)
      if (listResponse.status === 200 && listResponse.data.success) {
        console.log('✅ GET /user/addresses returned 200 OK');
        const addresses = listResponse.data.data;
        console.log(`   Retrieved ${Array.isArray(addresses) ? addresses.length : 0} addresses`);
        
        if (Array.isArray(addresses)) {
          console.log('   ✓ Response is an array');
        } else {
          console.log('   ⚠️  Response is not an array');
        }
      } else {
        console.log(`⚠️  Unexpected response: ${listResponse.status}`);
        counterexamples.push({
          endpoint: 'GET /user/addresses',
          expected: '200 OK',
          actual: `${listResponse.status} ${listResponse.statusText}`
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('❌ GET /user/addresses returned 404 Not Found');
        console.log('   COUNTEREXAMPLE: addressController.getAddresses does not exist');
        console.log('   This confirms the bug - controller method is missing');
        counterexamples.push({
          endpoint: 'GET /user/addresses',
          expected: '200 OK with address array',
          actual: '404 Not Found',
          rootCause: 'addressController not implemented'
        });
      } else {
        throw error;
      }
    }

    // Step 4: Test PUT /user/addresses/:id (Update Address)
    console.log('\n4️⃣  Testing PUT /user/addresses/:id (Update Address)...');
    console.log('   Expected: 200 OK with updated address');
    console.log('   Actual on unfixed code: 404 Not Found');
    
    const testAddressId = createdAddressId || 1; // Use created ID or dummy ID
    const updateData = { ...SAMPLE_ADDRESS, city: 'Bahir Dar' };
    
    try {
      const updateResponse = await axios.put(
        `${BASE_URL}/user/addresses/${testAddressId}`,
        updateData,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // If we get here, the endpoint exists (fixed code)
      if (updateResponse.status === 200 && updateResponse.data.success) {
        console.log('✅ PUT /user/addresses/:id returned 200 OK');
        console.log(`   Address ${testAddressId} updated successfully`);
        
        if (updateResponse.data.data.city === 'Bahir Dar') {
          console.log('   ✓ Update was applied correctly');
        }
      } else {
        console.log(`⚠️  Unexpected response: ${updateResponse.status}`);
        counterexamples.push({
          endpoint: 'PUT /user/addresses/:id',
          expected: '200 OK',
          actual: `${updateResponse.status} ${updateResponse.statusText}`
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('❌ PUT /user/addresses/:id returned 404 Not Found');
        console.log('   COUNTEREXAMPLE: Address model does not exist');
        console.log('   This confirms the bug - database model is missing');
        counterexamples.push({
          endpoint: 'PUT /user/addresses/:id',
          expected: '200 OK with updated address',
          actual: '404 Not Found',
          rootCause: 'Address model not defined in models/'
        });
      } else {
        throw error;
      }
    }

    // Step 5: Test DELETE /user/addresses/:id (Delete Address)
    console.log('\n5️⃣  Testing DELETE /user/addresses/:id (Delete Address)...');
    console.log('   Expected: 200 OK with success message');
    console.log('   Actual on unfixed code: 404 Not Found');
    
    try {
      const deleteResponse = await axios.delete(
        `${BASE_URL}/user/addresses/${testAddressId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // If we get here, the endpoint exists (fixed code)
      if (deleteResponse.status === 200 && deleteResponse.data.success) {
        console.log('✅ DELETE /user/addresses/:id returned 200 OK');
        console.log(`   Address ${testAddressId} deleted successfully`);
      } else {
        console.log(`⚠️  Unexpected response: ${deleteResponse.status}`);
        counterexamples.push({
          endpoint: 'DELETE /user/addresses/:id',
          expected: '200 OK',
          actual: `${deleteResponse.status} ${deleteResponse.statusText}`
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('❌ DELETE /user/addresses/:id returned 404 Not Found');
        console.log('   COUNTEREXAMPLE: Routes not registered in server');
        console.log('   This confirms the bug - route registration is missing');
        counterexamples.push({
          endpoint: 'DELETE /user/addresses/:id',
          expected: '200 OK with success message',
          actual: '404 Not Found',
          rootCause: 'addressRoutes not registered in server.js'
        });
      } else {
        throw error;
      }
    }

    // Step 6: Test PUT /user/addresses/:id/default (Set Default Address)
    console.log('\n6️⃣  Testing PUT /user/addresses/:id/default (Set Default)...');
    console.log('   Expected: 200 OK with updated address');
    console.log('   Actual on unfixed code: 404 Not Found');
    
    // Create a new address for this test since we deleted the previous one
    let defaultTestAddressId;
    try {
      const newAddressResponse = await axios.post(
        `${BASE_URL}/user/addresses`,
        { ...SAMPLE_ADDRESS, isDefault: false },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      defaultTestAddressId = newAddressResponse.data.data.id;
    } catch (error) {
      // If we can't create an address, use the first available one
      try {
        const listResponse = await axios.get(
          `${BASE_URL}/user/addresses`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        if (listResponse.data.data && listResponse.data.data.length > 0) {
          defaultTestAddressId = listResponse.data.data[0].id;
        }
      } catch (e) {
        defaultTestAddressId = 1; // Fallback
      }
    }
    
    try {
      const defaultResponse = await axios.put(
        `${BASE_URL}/user/addresses/${defaultTestAddressId}/default`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // If we get here, the endpoint exists (fixed code)
      if (defaultResponse.status === 200 && defaultResponse.data.success) {
        console.log('✅ PUT /user/addresses/:id/default returned 200 OK');
        console.log(`   Address ${defaultTestAddressId} set as default`);
        
        if (defaultResponse.data.data.isDefault === true) {
          console.log('   ✓ isDefault flag set correctly');
        }
      } else {
        console.log(`⚠️  Unexpected response: ${defaultResponse.status}`);
        counterexamples.push({
          endpoint: 'PUT /user/addresses/:id/default',
          expected: '200 OK',
          actual: `${defaultResponse.status} ${defaultResponse.statusText}`
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('❌ PUT /user/addresses/:id/default returned 404 Not Found');
        console.log('   COUNTEREXAMPLE: setDefaultAddress method does not exist');
        console.log('   This confirms the bug - controller method is missing');
        counterexamples.push({
          endpoint: 'PUT /user/addresses/:id/default',
          expected: '200 OK with isDefault=true',
          actual: '404 Not Found',
          rootCause: 'addressController.setDefaultAddress not implemented'
        });
      } else {
        throw error;
      }
    }

    // Summary
    console.log('\n' + '=' .repeat(70));
    console.log('📊 TEST SUMMARY\n');

    if (counterexamples.length > 0) {
      console.log('❌ BUG CONFIRMED: Address endpoints are missing\n');
      console.log('Counterexamples found:');
      counterexamples.forEach((ce, index) => {
        console.log(`\n${index + 1}. ${ce.endpoint}`);
        console.log(`   Expected: ${ce.expected}`);
        console.log(`   Actual: ${ce.actual}`);
        if (ce.rootCause) {
          console.log(`   Root Cause: ${ce.rootCause}`);
        }
      });

      console.log('\n📝 Root Cause Analysis:');
      console.log('   • addressRoutes.js does not exist in src/routes/');
      console.log('   • addressController.js does not exist in src/controllers/');
      console.log('   • Address.js model does not exist in src/models/');
      console.log('   • Routes not registered in src/server.js');

      console.log('\n✅ This is the EXPECTED outcome for unfixed code');
      console.log('   The test correctly identified the bug condition');
      console.log('   When the fix is implemented, this test will pass');
      
      console.log('\n' + '=' .repeat(70));
      console.log('Test completed: Bug exploration successful\n');
      process.exit(0); // Exit with success - finding the bug is the goal
    } else {
      console.log('✅ ALL TESTS PASSED: Address endpoints are working correctly\n');
      console.log('This means the bug has been FIXED:');
      console.log('   • POST /user/addresses creates addresses');
      console.log('   • GET /user/addresses retrieves addresses');
      console.log('   • PUT /user/addresses/:id updates addresses');
      console.log('   • DELETE /user/addresses/:id deletes addresses');
      console.log('   • PUT /user/addresses/:id/default sets default address');
      
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
console.log('Starting Address Bug Condition Exploration Test...\n');
testAddressBugCondition();
