const express = require('express');
const router = express.Router();
const categoriesController = require('../../controllers/admin/categories.controller');
const { upload } = require('../../middleware/upload');

router.get('/', categoriesController.getAllCategories);
router.post('/', upload.single('image'), categoriesController.createCategory);
router.put('/:id', upload.single('image'), categoriesController.updateCategory);
router.delete('/:id', categoriesController.deleteCategory);
router.put('/reorder', categoriesController.reorderCategories);

module.exports = router;
