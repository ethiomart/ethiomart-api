const express = require('express');
const router = express.Router();
const brandsController = require('../../controllers/admin/brands.controller');
const { upload } = require('../../middleware/upload');

router.get('/', brandsController.getBrands);
router.post('/', upload.single('logo'), brandsController.createBrand);
router.put('/:id', upload.single('logo'), brandsController.updateBrand);
router.delete('/:id', brandsController.deleteBrand);

module.exports = router;
