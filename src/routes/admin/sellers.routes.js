const express = require('express');
const router = express.Router();
const usersController = require('../../controllers/admin/users.controller');

// Matches frontend mapping: userService.getPendingSellers -> API.get('/admin/sellers/pending')
router.get('/pending', usersController.getPendingSellers);

// Matches frontend mapping: userService.approveSeller -> API.put(`/admin/sellers/${id}/approve`)
router.put('/:id/approve', usersController.approveSeller);

// Matches frontend mapping: userService.rejectSeller -> API.put(`/admin/sellers/${id}/reject`)
router.put('/:id/reject', usersController.rejectSeller);

module.exports = router;
