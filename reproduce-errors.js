const dashboardController = require('./src/controllers/admin/dashboard.controller');
const usersController = require('./src/controllers/admin/users.controller');

// Mock req, res, next
const mockRes = {
  json: (data) => console.log('Response JSON:', JSON.stringify(data, null, 2)),
  status: (code) => {
    console.log('Response Status:', code);
    return mockRes;
  }
};
const mockNext = (err) => {
  console.error('Next Error:', err);
  if (err.parent) console.error('  Parent Error:', err.parent.message);
};

async function reproduce() {
  console.log('--- Testing getDashboardStats ---');
  await dashboardController.getDashboardStats({ query: {} }, mockRes, mockNext);

  console.log('\n--- Testing getAllUsers ---');
  await usersController.getAllUsers({ query: { page: 1, limit: 10 } }, mockRes, mockNext);
}

reproduce();
