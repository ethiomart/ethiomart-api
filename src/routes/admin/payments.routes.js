const express = require('express');
const router = express.Router();
const paymentsController = require('../../controllers/admin/payments.controller');
const settingsController = require('../../controllers/admin/settings.controller'); // For Chapa config

router.get('/transactions', paymentsController.getTransactions);
router.get('/logs', paymentsController.getPaymentLogs);
router.put('/chapa/config', settingsController.updateChapaSettings);
router.get('/transactions/:id', paymentsController.getTransactionById);
router.post('/transactions/:id/retry', paymentsController.retryPayment);

module.exports = router;
