/**
 * Verification script for authController
 * This script checks if the authController has all required functions
 */

const authController = require('../controllers/authController');

console.log('Verifying authController...\n');

const requiredFunctions = [
  'register',
  'login',
  'refreshToken',
  'logout',
  'getProfile'
];

let allFunctionsPresent = true;

requiredFunctions.forEach(funcName => {
  if (typeof authController[funcName] === 'function') {
    console.log(`✓ ${funcName} - Present and is a function`);
  } else {
    console.log(`✗ ${funcName} - Missing or not a function`);
    allFunctionsPresent = false;
  }
});

console.log('\n' + '='.repeat(50));
if (allFunctionsPresent) {
  console.log('✓ All required functions are present!');
  console.log('authController.js is ready for use.');
} else {
  console.log('✗ Some functions are missing!');
  process.exit(1);
}
