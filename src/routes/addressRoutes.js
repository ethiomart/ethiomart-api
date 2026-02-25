const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { verifyToken } = require('../middleware/auth');
const { validateAddress, normalizeAddressFields, handleValidationErrors } = require('../middleware/validation');

/**
 * Address Routes
 * All routes require authentication (verifyToken middleware)
 * Base path: /api/user/addresses
 */

// POST /api/user/addresses - Create new address
router.post('/', verifyToken, normalizeAddressFields, validateAddress, handleValidationErrors, addressController.createAddress);

// GET /api/user/addresses - Get all addresses for authenticated user
router.get('/', verifyToken, addressController.getAddresses);

// PUT /api/user/addresses/:id/default - Set address as default (MUST come before /:id routes)
router.put('/:id/default', verifyToken, addressController.setDefaultAddress);

// GET /api/user/addresses/:id - Get single address by ID
router.get('/:id', verifyToken, addressController.getAddressById);

// PUT /api/user/addresses/:id - Update address
router.put('/:id', verifyToken, normalizeAddressFields, validateAddress, handleValidationErrors, addressController.updateAddress);

// DELETE /api/user/addresses/:id - Delete address
router.delete('/:id', verifyToken, addressController.deleteAddress);

module.exports = router;
