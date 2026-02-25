const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// POST /api/users/profile-picture - Upload profile picture
router.post('/profile-picture', verifyToken, uploadSingle('profilePicture'), userController.uploadProfilePicture);

// GET /api/users - Admin: Get all users
router.get('/', verifyToken, requireRole(['admin']), userController.getAllUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', verifyToken, userController.getUserById);

// PUT /api/users/:id - Update user
router.put('/:id', verifyToken, userController.updateUser);

// DELETE /api/users/:id - Admin: Delete user
router.delete('/:id', verifyToken, requireRole(['admin']), userController.deleteUser);

module.exports = router;
