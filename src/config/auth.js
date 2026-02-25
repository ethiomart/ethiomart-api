require('dotenv').config();
const jwt = require('jsonwebtoken');

const authConfig = {
  accessTokenSecret: process.env.JWT_SECRET,
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
  accessTokenExpiry: process.env.JWT_ACCESS_EXPIRE || '15m',
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRE || '7d'
};

/**
 * Generate access token for user
 * @param {Object} payload - User data to encode in token
 * @returns {string} JWT access token
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, authConfig.accessTokenSecret, {
    expiresIn: authConfig.accessTokenExpiry
  });
}

/**
 * Generate refresh token for user
 * @param {Object} payload - User data to encode in token
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, authConfig.refreshTokenSecret, {
    expiresIn: authConfig.refreshTokenExpiry
  });
}

/**
 * Verify access token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
function verifyAccessToken(token) {
  return jwt.verify(token, authConfig.accessTokenSecret);
}

/**
 * Verify refresh token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, authConfig.refreshTokenSecret);
}

module.exports = {
  ...authConfig,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
