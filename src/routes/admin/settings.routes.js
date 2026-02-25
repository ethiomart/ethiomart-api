const express = require('express');
const router = express.Router();
const settingsController = require('../../controllers/admin/settings.controller');
const { upload } = require('../../middleware/upload');

router.get('/', settingsController.getSettings);
router.put('/', upload.single('logo'), settingsController.updateSettings);
router.post('/test-email', settingsController.testEmailConnection);

module.exports = router;
