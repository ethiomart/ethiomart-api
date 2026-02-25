const express = require('express');
const router = express.Router();
const cmsController = require('../../controllers/admin/cms.controller');
const { upload } = require('../../middleware/upload');

// Banners
router.get('/banners', cmsController.getBanners);
router.post('/banners', upload.single('image'), cmsController.createBanner);
router.put('/banners/:id', upload.single('image'), cmsController.updateBanner);
router.delete('/banners/:id', cmsController.deleteBanner);
router.put('/banners/reorder', cmsController.reorderBanners);

// Static Pages
router.get('/pages', cmsController.getPages);
router.get('/pages/:id', cmsController.getPageById);
router.put('/pages/:id', cmsController.updatePage);

module.exports = router;
