const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, requireRole } = require('../middleware/auth');

// POST /api/categories - Admin: Create category
router.post('/', verifyToken, requireRole(['admin']), categoryController.createCategory);

// GET /api/categories - Get all categories
router.get('/', categoryController.getAllCategories);

// PUT /api/categories/:id - Admin: Update category
router.put('/:id', verifyToken, requireRole(['admin']), categoryController.updateCategory);

// DELETE /api/categories/:id - Admin: Delete category
router.delete('/:id', verifyToken, requireRole(['admin']), categoryController.deleteCategory);

module.exports = router;
