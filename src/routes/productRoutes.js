const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const { cloudinaryUpload } = require('../middleware/cloudinaryUpload');
const { validateProduct, handleValidationErrors } = require('../middleware/validation');

// Import variant routes
const variantRoutes = require('./variantRoutes');

// POST /api/products - Seller: Create product
router.post(
  '/',
  verifyToken,
  requireRole(['seller']),
  uploadMultiple('images', 5),
  cloudinaryUpload('products/images'),
  validateProduct,
  handleValidationErrors,
  productController.createProduct
);

// GET /api/products - Get all products
router.get('/', productController.getAllProducts);

// GET /api/products/search - Search products
router.get('/search', productController.searchProducts);

// GET /api/products/:id - Get product by ID
router.get('/:id', productController.getProductById);

// PUT /api/products/:id - Seller/Admin: Update product
router.put(
  '/:id',
  verifyToken,
  requireRole(['seller', 'admin']),
  uploadMultiple('images', 5),
  cloudinaryUpload('products/images'),
  productController.updateProduct
);

// DELETE /api/products/:id - Seller/Admin: Delete product
router.delete('/:id', verifyToken, requireRole(['seller', 'admin']), productController.deleteProduct);

// Mount variant routes at /api/products/:productId/variants
router.use('/:productId/variants', variantRoutes);

module.exports = router;
