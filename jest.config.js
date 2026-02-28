module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  testTimeout: 60000,
  forceExit: true,
  detectOpenHandles: true
};
