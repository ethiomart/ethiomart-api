const express = require('express');
const router = express.Router();
const cmsController = require('../../controllers/admin/cms.controller');
const { upload, uploadSingle } = require('../../middleware/upload');
const { cloudinaryUpload } = require('../../middleware/cloudinaryUpload');

// Banners
router.get('/banners', cmsController.getBanners);
router.post('/banners', uploadSingle('image'), cloudinaryUpload('admin/banners'), cmsController.createBanner);
router.put('/banners/:id', uploadSingle('image'), cloudinaryUpload('admin/banners'), cmsController.updateBanner);
router.delete('/banners/:id', cmsController.deleteBanner);
router.put('/banners/reorder', cmsController.reorderBanners);

// Static Pages
router.get('/pages', cmsController.getPages);
router.get('/pages/:id', cmsController.getPageById);
router.put('/pages/:id', cmsController.updatePage);

module.exports = router;
