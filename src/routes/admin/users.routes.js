const express = require('express');
const router = express.Router();
const usersController = require('../../controllers/admin/users.controller');

router.get('/', usersController.getAllUsers);
router.get('/pending-sellers', usersController.getPendingSellers);
router.put('/:id/status', usersController.updateUserStatus);
router.put('/sellers/:id/approve', usersController.approveSeller);
router.put('/sellers/:id/reject', usersController.rejectSeller);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
