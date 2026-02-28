const express = require('express');
const router = express.Router();
const attributesController = require('../../controllers/admin/attributes.controller');
const { verifyToken, requireRole } = require('../../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin']));

router.get('/', attributesController.getAttributes);
router.post('/', attributesController.createAttribute);
router.put('/:id', attributesController.updateAttribute);
router.delete('/:id', attributesController.deleteAttribute);

module.exports = router;
