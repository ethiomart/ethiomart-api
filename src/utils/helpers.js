const crypto = require('crypto');

/**
 * Generate a unique filename for uploaded files
 * @param {string} originalName - The original filename
 * @returns {string} - A unique filename with timestamp and random string
 */
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = originalName.split('.').pop();
  return `${timestamp}-${randomString}.${extension}`;
};

/**
 * Calculate the total amount for an order based on order items
 * @param {Array} orderItems - Array of order items with quantity and priceAtPurchase
 * @returns {number} - The total order amount
 */
const calculateOrderTotal = (orderItems) => {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return 0;
  }
  
  return orderItems.reduce((total, item) => {
    const itemTotal = (item.quantity || 0) * (item.priceAtPurchase || item.price || 0);
    return total + itemTotal;
  }, 0);
};

/**
 * Format a standardized API response
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - A message describing the result
 * @param {*} data - The response data (optional)
 * @returns {Object} - Formatted response object
 */
const formatResponse = (success, message, data = null) => {
  const response = {
    success,
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return response;
};

/**
 * Add pagination to a Sequelize query
 * @param {Object} query - The base Sequelize query options
 * @param {number} page - The page number (1-indexed)
 * @param {number} limit - The number of items per page
 * @returns {Object} - Query options with limit and offset added
 */
const paginate = (query, page = 1, limit = 10) => {
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  
  // Ensure valid positive numbers
  const validPage = pageNum > 0 ? pageNum : 1;
  const validLimit = limitNum > 0 && limitNum <= 100 ? limitNum : 10;
  
  const offset = (validPage - 1) * validLimit;
  
  return {
    ...query,
    limit: validLimit,
    offset
  };
};

/**
 * Generate a slug from a string
 * @param {string} text - The text to slugify
 * @returns {string} - The slugified string
 */
const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w-]+/g, '')   // Remove all non-word chars
    .replace(/--+/g, '-');     // Replace multiple - with single -
};

module.exports = {
  generateUniqueFilename,
  calculateOrderTotal,
  formatResponse,
  paginate,
  slugify
};
