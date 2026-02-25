/**
 * User role enumeration
 */
const USER_ROLES = {
  CUSTOMER: 'customer',
  SELLER: 'seller',
  ADMIN: 'admin'
};

/**
 * Order status enumeration
 */
const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  PAYMENT_FAILED: 'payment_failed'
};

/**
 * Payment status enumeration
 */
const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed'
};

/**
 * Allowed image MIME types for file uploads
 */
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

/**
 * Maximum file size for uploads (5MB in bytes)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

module.exports = {
  USER_ROLES,
  ORDER_STATUS,
  PAYMENT_STATUS,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE
};
