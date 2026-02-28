const chapaService = require('../services/chapaService');
const { Order, Payment, User, OrderItem, Product, Analytics, Seller } = require('../models');
const sequelize = require('../config/database');
const securityLogger = require('../utils/securityLogger');
const paymentMetrics = require('../utils/paymentMonitoring');

/**
 * Format response helper
 * @param {boolean} success - Success status
 * @param {string} message - Response message
 * @param {object} data - Response data
 * @returns {object} - Formatted response
 */
function formatResponse(success, message, data = null) {
  const response = { success, message };
  if (data) response.data = data;
  return response;
}

/**
 * Initialize payment
 * POST /api/payments/initiate
 * Validation is handled by validatePaymentInitialization middleware
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 11.1, 11.2, 11.3, 11.4
 * Properties: 1, 2, 3, 4, 5, 6, 44, 45, 46, 47
 */
async function initiatePayment(req, res) {
  const startTime = Date.now();
  const transaction = await sequelize.transaction();
  
  try {
    const { orderId, amount, email, firstName, lastName, phoneNumber, currency = 'ETB' } = req.body;
    const userId = req.user?.id;

    // Log payment initialization attempt
    securityLogger.logPaymentInitialization({
      orderId,
      amount: amount || 'from_order',
      currency,
      email,
      userId,
      ip: req.ip
    });

    // Find order with user details
    const order = await Order.findOne({
      where: { id: orderId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'first_name', 'last_name', 'phone']
      }],
      transaction
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
        error: `Order with ID ${orderId} not found`
      });
    }

    // Check if user owns the order (if userId is provided)
    if (userId && order.user_id !== userId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
        error: 'You do not have permission to access this order'
      });
    }

    // Check if order is already paid (Property 28)
    if (order.payment_status === 'paid' || order.order_status === 'completed') {
      await transaction.rollback();
      
      // Log duplicate payment attempt
      securityLogger.logDuplicatePaymentAttempt({
        orderId: order.id,
        reference: order.payment_reference || 'unknown',
        existingStatus: order.payment_status,
        ip: req.ip
      });
      
      return res.status(409).json({
        success: false,
        message: 'Conflict',
        error: 'Order is already paid'
      });
    }

    // Use provided amount or order total amount
    const paymentAmount = amount || parseFloat(order.total_amount);
    
    // Property 44: Positive Amount Validation (already handled by middleware)
    // Property 45: Currency Validation (already handled by middleware)
    // Property 46: Email Format Validation (already handled by middleware)
    
    // Use provided email or order user email
    const customerEmail = email || order.user?.email;
    const customerFirstName = firstName || order.user?.first_name || 'Customer';
    const customerLastName = lastName || order.user?.last_name || '';
    const customerPhone = phoneNumber || order.user?.phone;

    // Property 47: Input Sanitization (handled by validation middleware)
    
    // Property 1: Unique Transaction Reference Generation
    // Property 2: Payment Initialization API Call
    // Property 3: Authorization Header Presence
    // Initialize payment with Chapa
    const chapaResponse = await chapaService.initializePayment(
      orderId,
      paymentAmount,
      customerEmail,
      customerFirstName,
      customerLastName,
      customerPhone
    );

    // Property 6: Pending Payment Record Creation
    // Create payment record
    const payment = await Payment.create({
      order_id: order.id,
      amount: paymentAmount,
      currency: currency.toUpperCase(),
      status: 'pending',
      chapa_tx_ref: chapaResponse.reference,
      payment_data: {
        chapaResponse,
        customerEmail,
        customerFirstName,
        customerLastName,
        customerPhone
      }
    }, { transaction });

    await transaction.commit();

    // Record metrics
    paymentMetrics.recordPaymentInitialization({
      orderId: order.id,
      amount: paymentAmount
    });
    
    // Record response time
    const duration = Date.now() - startTime;
    paymentMetrics.recordResponseTime(duration, 'initialize');

    // Property 4: Checkout URL Extraction
    // Property 5: Error Message Propagation (handled in catch block)
    res.status(200).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        paymentUrl: chapaResponse.paymentUrl,
        reference: chapaResponse.reference,
        orderId: order.id,
        amount: paymentAmount,
        currency: currency.toUpperCase()
      }
    });
  } catch (error) {
    await transaction.rollback();
    
    // ============================================
    // DETAILED DATABASE VALIDATION ERROR LOGGING
    // ============================================
    
    // Log comprehensive error context
    console.error('=== PAYMENT INITIALIZATION ERROR ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    console.error('Order ID:', req.body?.orderId);
    console.error('Amount:', req.body?.amount);
    console.error('Currency:', req.body?.currency);
    
    // Log stack trace for debugging
    if (error.stack) {
      console.error('Stack Trace:', error.stack);
    }

    // Handle database validation errors
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => ({
        field: err.path,
        message: err.message,
        value: err.value,
        type: err.type
      }));
      
      console.error('=== DATABASE VALIDATION ERRORS ===');
      console.error('Total Validation Errors:', validationErrors.length);
      validationErrors.forEach((err, index) => {
        console.error(`\nValidation Error #${index + 1}:`);
        console.error('  Field:', err.field);
        console.error('  Message:', err.message);
        console.error('  Value:', err.value);
        console.error('  Type:', err.type);
      });
      console.error('==================================\n');
      
      return res.status(400).json({
        success: false,
        message: 'Payment validation failed',
        errors: validationErrors.map(e => `${e.field}: ${e.message}`)
      });
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      console.error('=== FOREIGN KEY CONSTRAINT ERROR ===');
      console.error('Table:', error.table);
      console.error('Fields:', error.fields);
      console.error('Value:', error.value);
      console.error('====================================\n');
      
      return res.status(400).json({
        success: false,
        message: 'Invalid reference in payment data'
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('=== UNIQUE CONSTRAINT ERROR ===');
      console.error('Fields:', error.fields);
      console.error('Value:', error.value);
      console.error('===============================\n');
      
      return res.status(400).json({
        success: false,
        message: 'Duplicate payment record detected'
      });
    }

    if (error.name === 'SequelizeDatabaseError') {
      console.error('=== DATABASE ERROR ===');
      console.error('SQL:', error.sql);
      console.error('Parameters:', error.parameters);
      console.error('======================\n');
      
      return res.status(500).json({
        success: false,
        message: 'Database error occurred during payment initialization'
      });
    }
    
    // Property 5: Error Message Propagation
    // Handle specific error types with appropriate status codes and messages
    // All error responses follow consistent format: {success, message, error, field (optional)}
    
    // Chapa API errors (502 Bad Gateway)
    if (error.message && error.message.includes('Chapa')) {
      return res.status(502).json({
        success: false,
        message: 'Payment service temporarily unavailable',
        error: 'Unable to connect to payment gateway. Please try again in a few moments.',
        technicalDetails: error.message,
        retryable: true
      });
    }
    
    // Timeout errors (408 Request Timeout)
    if (error.message && (error.message.includes('timeout') || error.message.includes('ETIMEDOUT'))) {
      return res.status(408).json({
        success: false,
        message: 'Request timed out',
        error: 'The payment request took too long. Please check your connection and try again.',
        technicalDetails: error.message,
        retryable: true
      });
    }
    
    // Configuration errors (503 Service Unavailable)
    if (error.message && (error.message.includes('configuration') || error.message.includes('CHAPA_SECRET_KEY'))) {
      return res.status(503).json({
        success: false,
        message: 'Payment service configuration error',
        error: 'Payment service is temporarily unavailable. Please try again later.',
        technicalDetails: error.message,
        retryable: false
      });
    }
    
    // Network errors (502 Bad Gateway)
    if (error.message && (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND') || error.message.includes('network'))) {
      return res.status(502).json({
        success: false,
        message: 'Network connection error',
        error: 'Unable to connect to payment service. Please check your internet connection and try again.',
        technicalDetails: error.message,
        retryable: true
      });
    }
    
    // Default server error (500 Internal Server Error)
    // Preserve error context - don't convert to generic message
    console.error('=== UNEXPECTED ERROR ===');
    console.error('Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('========================\n');
    
    res.status(500).json({
      success: false,
      message: 'Failed to initialize payment',
      error: error.message || 'An unexpected error occurred. Please try again.',
      technicalDetails: error.stack ? error.stack.split('\n')[0] : error.message
    });
  }
}

/**
 * Handle Chapa webhook callback
 * POST /api/payments/webhook
 * Validation is handled by validateWebhookPayload middleware
 * Requirements: 3.2, 3.3, 3.4, 3.5, 4.1, 11.5, 11.6
 * Properties: 12, 13, 14, 15, 16, 48, 49
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleWebhook = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const payload = req.body;
    const signature = req.headers['chapa-signature'] || req.headers['x-chapa-signature'];
    const { tx_ref, status, amount, ref_id } = payload;

    // Property 12: Callback Parameter Extraction
    if (!tx_ref) {
      return res.status(400).json(formatResponse(false, 'Missing transaction reference'));
    }

    // Property 48: Callback IP Validation (optional - can be implemented if Chapa provides IP whitelist)
    // For now, we rely on signature verification
    
    // Verify webhook signature (Property 48 partial)
    const isValidSignature = chapaService.verifyWebhookSignature(payload, signature);
    
    if (!isValidSignature && signature) {
      console.error(`Invalid webhook signature for tx_ref: ${tx_ref}`);
      
      // Log invalid signature attempt
      securityLogger.logInvalidWebhookSignature({
        txRef: tx_ref,
        ip: req.ip,
        signature: signature ? 'present' : 'missing'
      });
      
      return res.status(401).json(formatResponse(false, 'Invalid webhook signature'));
    }

    // Property 13: Callback Logging
    console.log(`Webhook received at ${new Date().toISOString()}: tx_ref=${tx_ref}, status=${status}, amount=${amount}`);
    
    // Log webhook received
    securityLogger.logWebhookReceived({
      txRef: tx_ref,
      status,
      amount,
      ip: req.ip,
      signature
    });

    // Property 49: Transaction Reference Validation
    // Find payment by Chapa reference
    const payment = await Payment.findOne({
      where: { chapa_tx_ref: tx_ref },
      include: [{ 
        model: Order, 
        as: 'order',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name']
        }]
      }]
    });

    if (!payment) {
      console.error(`Payment not found for reference: ${tx_ref}`);
      // Property 14: Callback Acknowledgment (still acknowledge even if not found)
      return res.status(200).json(formatResponse(true, 'Webhook received but payment not found'));
    }

    // Property 49: Validate transaction is pending
    if (payment.status !== 'pending') {
      console.log(`Payment ${payment.id} already processed with status: ${payment.status}`);
      // Property 14: Callback Acknowledgment
      return res.status(200).json(formatResponse(true, 'Webhook processed - payment already completed'));
    }

    // Property 15: No Direct Order Update from Callback
    // We log the webhook but don't trust it - we verify with Chapa API
    console.log(`Webhook data logged for tx_ref ${tx_ref}. Triggering server-side verification...`);

    // Property 16: Verification API Call on Callback
    // Trigger verification asynchronously (don't block webhook response)
    setImmediate(async () => {
      try {
        const verificationResult = await chapaService.verifyPayment(tx_ref);
        
        // Validate amount and currency
        const expectedAmount = parseFloat(payment.amount);
        const verifiedAmount = parseFloat(verificationResult.amount);
        const expectedCurrency = payment.currency || 'ETB';
        const verifiedCurrency = verificationResult.currency || 'ETB';
        
        if (Math.abs(expectedAmount - verifiedAmount) > 0.01) {
          console.error(`Amount mismatch in webhook verification: expected ${expectedAmount}, got ${verifiedAmount}`);
          
          // Log amount mismatch
          securityLogger.logAmountMismatch({
            paymentId: payment.id,
            reference: tx_ref,
            expectedAmount,
            receivedAmount: verifiedAmount
          });
          
          payment.status = 'failed';
          payment.chapa_response = { ...verificationResult, error: 'Amount mismatch' };
          await payment.save();
          return;
        }
        
        if (expectedCurrency !== verifiedCurrency) {
          console.error(`Currency mismatch in webhook verification: expected ${expectedCurrency}, got ${verifiedCurrency}`);
          
          // Log currency mismatch
          securityLogger.logCurrencyMismatch({
            paymentId: payment.id,
            reference: tx_ref,
            expectedCurrency,
            receivedCurrency: verifiedCurrency
          });
          
          payment.status = 'failed';
          payment.chapa_response = { ...verificationResult, error: 'Currency mismatch' };
          await payment.save();
          return;
        }
        
        // Update payment and order based on verified status
        if (verificationResult.status === 'success') {
          payment.status = 'success';
          payment.payment_method = verificationResult.paymentMethod;
          payment.transaction_id = verificationResult.transactionId;
          payment.chapa_response = verificationResult;
          payment.paid_at = new Date();
          await payment.save();

          const order = payment.order;
          if (order && order.payment_status !== 'paid') {
            order.payment_status = 'paid';
            order.order_status = 'confirmed';
            order.paid_at = new Date();
            order.payment_method = verificationResult.paymentMethod;
            await order.save();

            // Record payment success metrics
            paymentMetrics.recordPaymentSuccess({
              paymentId: payment.id,
              orderId: order.id,
              amount: payment.amount,
              paymentMethod: verificationResult.paymentMethod
            });

            // Log payment success
            securityLogger.logPaymentSuccess({
              paymentId: payment.id,
              orderId: order.id,
              reference: tx_ref,
              amount: payment.amount,
              currency: payment.currency,
              paymentMethod: verificationResult.paymentMethod
            });

            // Log order confirmation
            securityLogger.logOrderConfirmation({
              orderId: order.id,
              orderNumber: order.order_number,
              paymentId: payment.id,
              reference: tx_ref,
              amount: payment.amount
            });

            // Send confirmation email
            // Task 16.1.3: Implement graceful degradation for email failures
            try {
              const emailService = require('../services/emailService');
              const emailResult = await emailService.sendPaymentConfirmation({
                email: order.user?.email,
                firstName: order.user?.first_name,
                lastName: order.user?.last_name,
                orderId: order.id,
                orderNumber: order.order_number,
                amount: payment.amount,
                currency: payment.currency,
                paymentMethod: verificationResult.paymentMethod,
                reference: tx_ref
              });
              
              // Log email result but don't fail payment
              if (!emailResult.success) {
                const logger = require('../utils/logger');
                logger.logEmailFailure({
                  emailType: 'payment_confirmation',
                  recipient: order.user?.email,
                  error: emailResult.error,
                  orderId: order.id,
                  paymentId: payment.id
                });
              }
            } catch (emailError) {
              // Task 16.1.3: Graceful degradation - log error but don't fail payment
              const logger = require('../utils/logger');
              logger.logEmailFailure({
                emailType: 'payment_confirmation',
                recipient: order.user?.email,
                error: emailError.message,
                orderId: order.id,
                paymentId: payment.id
              });
              
              console.error('Failed to send confirmation email from webhook:', emailError.message);
            }
          }

            // Update seller analytics for this order
            try {
              const orderItems = await OrderItem.findAll({ where: { order_id: order.id } });
              for (const item of orderItems) {
                if (item.seller_id) {
                  const revenue = item.price_at_purchase * item.quantity;
                  const commission = revenue * 0.1; // Example commission rate

                  // Find or create analytics record for current month
                  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
                  
                  await Analytics.findOrCreate({
                    where: { 
                      seller_id: item.seller_id,
                      period: currentMonth
                    },
                    defaults: {
                      total_sales: 0,
                      total_orders: 0,
                      total_revenue: 0,
                      total_commission: 0
                    }
                  }).then(async ([analytics]) => {
                    await analytics.increment({
                      total_sales: item.quantity,
                      total_orders: 1, // Only counted once per order per seller ideally, simplified here
                      total_revenue: revenue,
                      total_commission: commission
                    });
                  });
                  
                  // Also update Seller total revenue
                  const seller = await Seller.findByPk(item.seller_id);
                  if (seller) {
                    await seller.increment({
                      total_revenue: revenue,
                      total_orders: 1
                    });
                  }
                }
              }
            } catch (analyticsError) {
              console.error('Failed to update analytics:', analyticsError.message);
            }

          console.log(`Payment verified and confirmed for order ${order?.id}`);
        } else if (verificationResult.status === 'failed') {
          payment.status = 'failed';
          payment.chapa_response = verificationResult;
          await payment.save();

          const order = payment.order;
          if (order && order.payment_status !== 'failed') {
            order.payment_status = 'failed';
            order.order_status = 'pending';
            await order.save();
          }

          // Record payment failure metrics
          paymentMetrics.recordPaymentFailure({
            paymentId: payment.id,
            orderId: order?.id,
            amount: payment.amount,
            reason: verificationResult.message || 'Payment failed'
          });

          // Log payment failure
          securityLogger.logPaymentFailure({
            paymentId: payment.id,
            orderId: order?.id,
            reference: tx_ref,
            amount: payment.amount,
            reason: verificationResult.message || 'Payment failed'
          });

          // Send payment failure email
          // Task 16.1.3: Implement graceful degradation for email failures
          try {
            const emailService = require('../services/emailService');
            const emailResult = await emailService.sendPaymentFailure({
              email: order.user?.email,
              firstName: order.user?.first_name,
              lastName: order.user?.last_name,
              orderId: order.id,
              orderNumber: order.order_number,
              amount: payment.amount,
              currency: payment.currency,
              reference: tx_ref,
              failureReason: verificationResult.message || 'Payment could not be processed'
            });
            
            // Log email result but don't fail verification
            if (!emailResult.success) {
              const logger = require('../utils/logger');
              logger.logEmailFailure({
                emailType: 'payment_failure',
                recipient: order.user?.email,
                error: emailResult.error,
                orderId: order.id,
                paymentId: payment.id
              });
            }
          } catch (emailError) {
            // Task 16.1.3: Graceful degradation - log error but don't fail verification
            const logger = require('../utils/logger');
            logger.logEmailFailure({
              emailType: 'payment_failure',
              recipient: order.user?.email,
              error: emailError.message,
              orderId: order.id,
              paymentId: payment.id
            });
            
            console.error('Failed to send payment failure email from webhook:', emailError.message);
          }

          console.log(`Payment verification failed for order ${order?.id}`);
        }
      } catch (verifyError) {
        console.error(`Async verification failed for tx_ref ${tx_ref}:`, verifyError.message);
      }
    });

    // Property 14: Callback Acknowledgment
    // Respond immediately to Chapa (don't wait for verification)
    
    // Record webhook delivery success
    const duration = Date.now() - startTime;
    paymentMetrics.recordWebhookDelivery(true, { txRef: tx_ref });
    paymentMetrics.recordResponseTime(duration, 'webhook');
    
    res.status(200).json(formatResponse(true, 'Webhook received and processing'));
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Record webhook delivery failure
    paymentMetrics.recordWebhookDelivery(false, { 
      txRef: req.body?.tx_ref, 
      reason: error.message 
    });
    
    // Property 14: Still acknowledge receipt even on error
    res.status(200).json(formatResponse(true, 'Webhook received with errors', { error: error.message }));
  }
};

/**
 * Manually verify payment status
 * GET /api/payments/verify/:reference
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 * Properties: 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 52
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyPayment = async (req, res) => {
  const startTime = Date.now();
  const transaction = await sequelize.transaction();
  
  try {
    const { reference } = req.params;

    if (!reference) {
      await transaction.rollback();
      return res.status(400).json(formatResponse(false, 'Payment reference is required'));
    }

    // Log verification attempt
    securityLogger.logPaymentVerification({
      reference,
      userId: req.user?.id,
      ip: req.ip
    });

    // Find payment by reference
    const payment = await Payment.findOne({
      where: { chapa_tx_ref: reference },
      include: [{ 
        model: Order, 
        as: 'order',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name']
        }]
      }],
      transaction
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json(formatResponse(false, 'Payment not found'));
    }

    // Verify payment with Chapa (with retry logic)
    const verificationResult = await chapaService.verifyPayment(reference);

    // Property 17: Status Validation in Verification
    // Property 18: Amount Validation in Verification
    // Property 19: Currency Validation in Verification
    // Property 52: Payment Round-Trip Validation
    
    // Validate amount matches (Property 18)
    const expectedAmount = parseFloat(payment.amount);
    const verifiedAmount = parseFloat(verificationResult.amount);
    
    if (Math.abs(expectedAmount - verifiedAmount) > 0.01) {
      // Property 20: Verification Failure Logging
      console.error(`Amount mismatch for payment ${payment.id}: expected ${expectedAmount}, got ${verifiedAmount}`);
      
      // Log amount mismatch
      securityLogger.logAmountMismatch({
        paymentId: payment.id,
        reference,
        expectedAmount,
        receivedAmount: verifiedAmount
      });
      
      // Property 53: Round-Trip Mismatch Rejection
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: 'Amount mismatch detected',
        details: {
          expected: expectedAmount,
          received: verifiedAmount
        }
      });
    }

    // Validate currency matches (Property 19)
    const expectedCurrency = payment.currency || 'ETB';
    const verifiedCurrency = verificationResult.currency || 'ETB';
    
    if (expectedCurrency !== verifiedCurrency) {
      // Property 20: Verification Failure Logging
      console.error(`Currency mismatch for payment ${payment.id}: expected ${expectedCurrency}, got ${verifiedCurrency}`);
      
      // Log currency mismatch
      securityLogger.logCurrencyMismatch({
        paymentId: payment.id,
        reference,
        expectedCurrency,
        receivedCurrency: verifiedCurrency
      });
      
      // Property 53: Round-Trip Mismatch Rejection
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: 'Currency mismatch detected',
        details: {
          expected: expectedCurrency,
          received: verifiedCurrency
        }
      });
    }

    // Property 17: Status Validation in Verification
    if (verificationResult.status === 'success') {
      // Property 28: No Confirmation Without Verification (already verified above)
      // Property 21: Order Confirmation on Successful Verification
      
      // Update payment status
      payment.status = 'success';
      payment.payment_method = verificationResult.paymentMethod;
      payment.transaction_id = verificationResult.transactionId;
      payment.chapa_response = verificationResult;
      payment.paid_at = new Date();
      await payment.save({ transaction });

      // Property 23: Order Status Update on Confirmation
      const order = payment.order;
      if (order.payment_status !== 'paid') {
        order.payment_status = 'paid';
        order.order_status = 'confirmed';
        order.paid_at = new Date();
        
        // Property 24: Chapa Reference Storage
        order.payment_method = verificationResult.paymentMethod;
        await order.save({ transaction });

        // Log payment success
        securityLogger.logPaymentSuccess({
          paymentId: payment.id,
          orderId: order.id,
          reference,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: verificationResult.paymentMethod
        });

        // Log order confirmation
        securityLogger.logOrderConfirmation({
          orderId: order.id,
          orderNumber: order.order_number,
          paymentId: payment.id,
          reference,
          amount: payment.amount
        });

        // Property 25: Confirmation Email Sending
        // Property 26: Success Response on Confirmation
        // Task 16.1.3: Implement graceful degradation for email failures
        // Task 16.1.4: Add retry queue for failed operations
        try {
          const emailService = require('../services/emailService');
          const emailResult = await emailService.sendPaymentConfirmation({
            email: order.user?.email,
            firstName: order.user?.first_name,
            lastName: order.user?.last_name,
            orderId: order.id,
            orderNumber: order.order_number,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: verificationResult.paymentMethod,
            reference: reference
          });
          
          // Log email result but don't fail payment
          if (!emailResult.success) {
            const logger = require('../utils/logger');
            logger.logEmailFailure({
              emailType: 'payment_confirmation',
              recipient: order.user?.email,
              error: emailResult.error,
              orderId: order.id,
              paymentId: payment.id
            });
          }
        } catch (emailError) {
          // Property 27: Confirmation Failure Handling
          // Task 16.1.3: Graceful degradation - log error but don't fail payment
          // Task 16.1.4: Add to retry queue
          const logger = require('../utils/logger');
          const retryQueue = require('../utils/retryQueue');
          
          logger.logEmailFailure({
            emailType: 'payment_confirmation',
            recipient: order.user?.email,
            error: emailError.message,
            orderId: order.id,
            paymentId: payment.id
          });
          
          console.error('Failed to send confirmation email:', emailError.message);
          
          // Add to retry queue
          const emailService = require('../services/emailService');
          retryQueue.addEmailToQueue(
            async () => {
              await emailService.sendPaymentConfirmation({
                email: order.user?.email,
                firstName: order.user?.first_name,
                lastName: order.user?.last_name,
                orderId: order.id,
                orderNumber: order.order_number,
                amount: payment.amount,
                currency: payment.currency,
                paymentMethod: verificationResult.paymentMethod,
                reference: reference
              });
            },
            {
              emailType: 'payment_confirmation',
              recipient: order.user?.email,
              orderId: order.id,
              paymentId: payment.id,
              reference: reference
            }
          );
          
          // Don't fail the payment, just log the error
          // Mark for manual review if needed
          order.admin_notes = (order.admin_notes || '') + `\nConfirmation email failed: ${emailError.message}`;
          await order.save({ transaction });
        }
      }

      await transaction.commit();

      // Record metrics
      paymentMetrics.recordPaymentSuccess({
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: payment.amount,
        paymentMethod: verificationResult.paymentMethod
      });
      
      // Record response time
      const duration = Date.now() - startTime;
      paymentMetrics.recordResponseTime(duration, 'verify');

      res.status(200).json(formatResponse(true, 'Payment verification completed', {
        payment: {
          id: payment.id,
          orderId: payment.order_id,
          amount: payment.amount.toString(),
          status: payment.status,
          chapaReference: payment.chapa_tx_ref,
          paymentMethod: payment.payment_method
        },
        verificationResult
      }));
    } else if (verificationResult.status === 'failed') {
      // Property 35: Failure Reason Extraction
      const failureReason = verificationResult.message || 'Payment failed';
      
      payment.status = 'failed';
      payment.chapa_response = verificationResult;
      await payment.save({ transaction });

      // Update order status to payment_failed
      const order = payment.order;
      if (order.payment_status !== 'failed') {
        order.payment_status = 'failed';
        order.order_status = 'pending';
        await order.save({ transaction });
      }

      // Record metrics
      paymentMetrics.recordPaymentFailure({
        paymentId: payment.id,
        orderId: order.id,
        amount: payment.amount,
        reason: failureReason
      });

      // Log payment failure
      securityLogger.logPaymentFailure({
        paymentId: payment.id,
        orderId: order.id,
        reference,
        amount: payment.amount,
        reason: failureReason
      });

      // Send payment failure email
      // Task 16.1.3: Implement graceful degradation for email failures
      try {
        const emailService = require('../services/emailService');
        const emailResult = await emailService.sendPaymentFailure({
          email: order.user?.email,
          firstName: order.user?.first_name,
          lastName: order.user?.last_name,
          orderId: order.id,
          orderNumber: order.order_number,
          amount: payment.amount,
          currency: payment.currency,
          reference: reference,
          failureReason: failureReason
        });
        
        // Log email result but don't fail verification
        if (!emailResult.success) {
          const logger = require('../utils/logger');
          logger.logEmailFailure({
            emailType: 'payment_failure',
            recipient: order.user?.email,
            error: emailResult.error,
            orderId: order.id,
            paymentId: payment.id
          });
        }
      } catch (emailError) {
        // Task 16.1.3: Graceful degradation - log error but don't fail verification
        const logger = require('../utils/logger');
        logger.logEmailFailure({
          emailType: 'payment_failure',
          recipient: order.user?.email,
          error: emailError.message,
          orderId: order.id,
          paymentId: payment.id
        });
        
        console.error('Failed to send payment failure email:', emailError.message);
        // Don't fail the verification, just log the error
      }

      await transaction.commit();

      // Record response time
      const duration = Date.now() - startTime;
      paymentMetrics.recordResponseTime(duration, 'verify');

      // Property 36: Failure Reason Propagation
      res.status(200).json(formatResponse(true, 'Payment verification completed', {
        payment: {
          id: payment.id,
          orderId: payment.order_id,
          amount: payment.amount.toString(),
          status: payment.status,
          chapaReference: payment.chapa_tx_ref,
          paymentMethod: payment.payment_method,
          failureReason: failureReason
        },
        verificationResult
      }));
    } else {
      // Pending or unknown status
      await transaction.commit();
      
      // Record response time
      const duration = Date.now() - startTime;
      paymentMetrics.recordResponseTime(duration, 'verify');
      
      res.status(200).json(formatResponse(true, 'Payment verification completed', {
        payment: {
          id: payment.id,
          orderId: payment.order_id,
          amount: payment.amount.toString(),
          status: payment.status,
          chapaReference: payment.chapa_tx_ref,
          paymentMethod: payment.payment_method
        },
        verificationResult
      }));
    }
  } catch (error) {
    await transaction.rollback();
    console.error('Payment verification error:', error);
    
    // Property 20: Verification Failure Logging
    console.error(`Verification failed for reference ${req.params.reference}: ${error.message}`);
    
    res.status(500).json(formatResponse(false, 'Failed to verify payment', { error: error.message }));
  }
};

/**
 * Get payment history with filtering
 * GET /api/payments/history
 * Requirements: 8.6
 * Properties: 43
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentHistory = async (req, res) => {
  try {
    const { orderId, txRef, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause based on filters
    const where = {};
    
    if (orderId) {
      where.order_id = orderId;
    }
    
    if (txRef) {
      where.chapa_tx_ref = txRef;
    }
    
    if (status) {
      where.status = status;
    }

    // Property 43: Admin Query Endpoint Functionality
    const { count, rows: payments } = await Payment.findAndCountAll({
      where,
      include: [{
        model: Order,
        as: 'order',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name']
        }]
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      message: 'Payment history retrieved successfully',
      data: {
        payments: payments.map(p => ({
          id: p.id,
          orderId: p.order_id,
          orderNumber: p.order?.order_number,
          amount: p.amount.toString(),
          currency: p.currency,
          status: p.status,
          paymentMethod: p.payment_method,
          chapaReference: p.chapa_tx_ref,
          transactionId: p.transaction_id,
          customerEmail: p.order?.user?.email,
          customerName: `${p.order?.user?.first_name || ''} ${p.order?.user?.last_name || ''}`.trim(),
          paidAt: p.paid_at,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment history',
      error: error.message
    });
  }
};

/**
 * Manually verify a transaction (admin endpoint)
 * POST /api/payments/admin/verify/:reference
 * Requirements: 8.7, 10.7
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const adminVerifyPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { reference } = req.params;

    if (!reference) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    // Find payment by reference
    const payment = await Payment.findOne({
      where: { chapa_tx_ref: reference },
      include: [{
        model: Order,
        as: 'order',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name']
        }]
      }],
      transaction
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify payment with Chapa (with retry logic)
    const verificationResult = await chapaService.verifyPayment(reference);

    // Validate amount and currency
    const expectedAmount = parseFloat(payment.amount);
    const verifiedAmount = parseFloat(verificationResult.amount);
    const expectedCurrency = payment.currency || 'ETB';
    const verifiedCurrency = verificationResult.currency || 'ETB';

    if (Math.abs(expectedAmount - verifiedAmount) > 0.01) {
      console.error(`Admin verification - Amount mismatch for payment ${payment.id}: expected ${expectedAmount}, got ${verifiedAmount}`);
      
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: 'Amount mismatch detected',
        details: {
          expected: expectedAmount,
          received: verifiedAmount
        }
      });
    }

    if (expectedCurrency !== verifiedCurrency) {
      console.error(`Admin verification - Currency mismatch for payment ${payment.id}: expected ${expectedCurrency}, got ${verifiedCurrency}`);
      
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: 'Currency mismatch detected',
        details: {
          expected: expectedCurrency,
          received: verifiedCurrency
        }
      });
    }

    // Update payment and order based on verification result
    if (verificationResult.status === 'success') {
      payment.status = 'success';
      payment.payment_method = verificationResult.paymentMethod;
      payment.transaction_id = verificationResult.transactionId;
      payment.chapa_response = verificationResult;
      payment.paid_at = new Date();
      await payment.save({ transaction });

      const order = payment.order;
      if (order.payment_status !== 'paid') {
        order.payment_status = 'paid';
        order.order_status = 'confirmed';
        order.paid_at = new Date();
        order.payment_method = verificationResult.paymentMethod;
        await order.save({ transaction });

        // Send confirmation email
        try {
          const emailService = require('../services/emailService');
          await emailService.sendPaymentConfirmation({
            email: order.user?.email,
            firstName: order.user?.first_name,
            lastName: order.user?.last_name,
            orderId: order.id,
            orderNumber: order.order_number,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: verificationResult.paymentMethod,
            reference: reference
          });
        } catch (emailError) {
          console.error('Failed to send confirmation email (admin verification):', emailError.message);
          order.admin_notes = (order.admin_notes || '') + `\nConfirmation email failed (admin verification): ${emailError.message}`;
          await order.save({ transaction });
        }
      }

      await transaction.commit();

      res.status(200).json({
        success: true,
        message: 'Payment manually verified and confirmed',
        data: {
          payment: {
            id: payment.id,
            orderId: payment.order_id,
            amount: payment.amount.toString(),
            status: payment.status,
            chapaReference: payment.chapa_tx_ref,
            paymentMethod: payment.payment_method
          },
          verificationResult
        }
      });
    } else if (verificationResult.status === 'failed') {
      payment.status = 'failed';
      payment.chapa_response = verificationResult;
      await payment.save({ transaction });

      const order = payment.order;
      if (order.payment_status !== 'failed') {
        order.payment_status = 'failed';
        order.order_status = 'pending';
        await order.save({ transaction });
      }

      // Send payment failure email
      try {
        const emailService = require('../services/emailService');
        await emailService.sendPaymentFailure({
          email: order.user?.email,
          firstName: order.user?.first_name,
          lastName: order.user?.last_name,
          orderId: order.id,
          orderNumber: order.order_number,
          amount: payment.amount,
          currency: payment.currency,
          reference: reference,
          failureReason: verificationResult.message || 'Payment failed'
        });
      } catch (emailError) {
        console.error('Failed to send payment failure email (admin verification):', emailError.message);
      }

      await transaction.commit();

      res.status(200).json({
        success: true,
        message: 'Payment verification completed - payment failed',
        data: {
          payment: {
            id: payment.id,
            orderId: payment.order_id,
            amount: payment.amount.toString(),
            status: payment.status,
            chapaReference: payment.chapa_tx_ref,
            paymentMethod: payment.payment_method,
            failureReason: verificationResult.message || 'Payment failed'
          },
          verificationResult
        }
      });
    } else {
      await transaction.commit();
      
      res.status(200).json({
        success: true,
        message: 'Payment verification completed - status pending',
        data: {
          payment: {
            id: payment.id,
            orderId: payment.order_id,
            amount: payment.amount.toString(),
            status: payment.status,
            chapaReference: payment.chapa_tx_ref,
            paymentMethod: payment.payment_method
          },
          verificationResult
        }
      });
    }
  } catch (error) {
    await transaction.rollback();
    console.error('Admin payment verification error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

/**
 * Handle Chapa callback (Task 7.1)
 * POST /api/payments/callback
 * Requirements: Callback URL handling with immediate acknowledgment and async verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleCallback = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const payload = req.body;
    const { tx_ref, status, amount, currency } = payload;

    // Task 7.2: Extract tx_ref, status, amount, currency from callback payload
    if (!tx_ref) {
      console.error('Callback received without tx_ref');
      // Task 7.4: Respond with HTTP 200 immediately to acknowledge receipt
      return res.status(200).json({
        success: true,
        message: 'Callback received but missing transaction reference'
      });
    }

    // Task 7.3: Log callback receipt with timestamp and payload details
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Callback received: tx_ref=${tx_ref}, status=${status}, amount=${amount}, currency=${currency}`);
    
    // Log callback received
    securityLogger.logWebhookReceived({
      txRef: tx_ref,
      status,
      amount,
      currency,
      ip: req.ip,
      timestamp
    });

    // Task 7.4: Respond with HTTP 200 immediately to acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Callback received and processing'
    });

    // Task 7.5: Implement async verification with Chapa's API
    // Task 7.6: Update payment record with verified status
    // Task 7.7: Update order status if payment succeeded
    // Task 7.8: Handle idempotency (ignore duplicate callbacks for same tx_ref)
    // Task 7.9: Add error handling for verification failures
    // Task 7.10: Send confirmation email to customer after successful payment
    setImmediate(async () => {
      // Use a transaction with row-level locking to prevent race conditions
      const transaction = await sequelize.transaction();
      
      try {
        // Task 7.8: Handle idempotency with database-level locking
        // Find payment by Chapa reference with row-level lock (FOR UPDATE)
        // This prevents concurrent callbacks from processing the same payment
        const payment = await Payment.findOne({
          where: { chapa_tx_ref: tx_ref },
          include: [{ 
            model: Order, 
            as: 'order',
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'email', 'first_name', 'last_name']
            }]
          }],
          lock: transaction.LOCK.UPDATE,
          transaction
        });

        if (!payment) {
          await transaction.rollback();
          console.error(`Callback processing: Payment not found for tx_ref ${tx_ref}`);
          return;
        }

        // Task 7.8: Handle idempotency - check if already processed
        // If payment is not pending, it has already been processed by a previous callback
        if (payment.status !== 'pending') {
          await transaction.rollback();
          console.log(`Callback processing: Duplicate callback detected for tx_ref ${tx_ref}. Payment ${payment.id} already processed with status ${payment.status}. Ignoring.`);
          
          // Log duplicate callback attempt for monitoring
          securityLogger.logDuplicateCallback({
            txRef: tx_ref,
            paymentId: payment.id,
            currentStatus: payment.status,
            ip: req.ip,
            timestamp: new Date().toISOString()
          });
          
          return;
        }

        // Task 7.5: Verify payment with Chapa's API
        console.log(`Callback processing: Triggering verification for tx_ref ${tx_ref}`);
        const verificationResult = await chapaService.verifyPayment(tx_ref);

        // Validate amount and currency match
        const expectedAmount = parseFloat(payment.amount);
        const verifiedAmount = parseFloat(verificationResult.amount);
        const expectedCurrency = payment.currency || 'ETB';
        const verifiedCurrency = verificationResult.currency || 'ETB';

        if (Math.abs(expectedAmount - verifiedAmount) > 0.01) {
          console.error(`Callback verification: Amount mismatch for tx_ref ${tx_ref}: expected ${expectedAmount}, got ${verifiedAmount}`);
          
          securityLogger.logAmountMismatch({
            paymentId: payment.id,
            reference: tx_ref,
            expectedAmount,
            receivedAmount: verifiedAmount
          });

          // Task 7.6: Update payment record with failure
          payment.status = 'failed';
          payment.chapa_response = { ...verificationResult, error: 'Amount mismatch' };
          await payment.save({ transaction });
          await transaction.commit();
          return;
        }

        if (expectedCurrency !== verifiedCurrency) {
          console.error(`Callback verification: Currency mismatch for tx_ref ${tx_ref}: expected ${expectedCurrency}, got ${verifiedCurrency}`);
          
          securityLogger.logCurrencyMismatch({
            paymentId: payment.id,
            reference: tx_ref,
            expectedCurrency,
            receivedCurrency: verifiedCurrency
          });

          // Task 7.6: Update payment record with failure
          payment.status = 'failed';
          payment.chapa_response = { ...verificationResult, error: 'Currency mismatch' };
          await payment.save({ transaction });
          await transaction.commit();
          return;
        }

        // Task 7.6: Update payment record with verified status
        if (verificationResult.status === 'success') {
          payment.status = 'success';
          payment.payment_method = verificationResult.paymentMethod;
          payment.transaction_id = verificationResult.transactionId;
          payment.chapa_response = verificationResult;
          payment.paid_at = new Date();
          await payment.save({ transaction });

          // Task 7.7: Update order status if payment succeeded
          const order = payment.order;
          if (order && order.payment_status !== 'paid') {
            order.payment_status = 'paid';
            order.order_status = 'confirmed';
            order.paid_at = new Date();
            order.payment_method = verificationResult.paymentMethod;
            await order.save({ transaction });

            // Commit transaction before sending emails and updating analytics
            // This ensures payment and order status are persisted even if email/analytics fail
            await transaction.commit();

            // Log payment success
            securityLogger.logPaymentSuccess({
              paymentId: payment.id,
              orderId: order.id,
              reference: tx_ref,
              amount: payment.amount,
              currency: payment.currency,
              paymentMethod: verificationResult.paymentMethod
            });

            // Log order confirmation
            securityLogger.logOrderConfirmation({
              orderId: order.id,
              orderNumber: order.order_number,
              paymentId: payment.id,
              reference: tx_ref,
              amount: payment.amount
            });

            // Task 7.10: Send confirmation email to customer after successful payment
            try {
              const emailService = require('../services/emailService');
              const emailResult = await emailService.sendPaymentConfirmation({
                email: order.user?.email,
                firstName: order.user?.first_name,
                lastName: order.user?.last_name,
                orderId: order.id,
                orderNumber: order.order_number,
                amount: payment.amount,
                currency: payment.currency,
                paymentMethod: verificationResult.paymentMethod,
                reference: tx_ref
              });

              if (!emailResult.success) {
                const logger = require('../utils/logger');
                logger.logEmailFailure({
                  emailType: 'payment_confirmation',
                  recipient: order.user?.email,
                  error: emailResult.error,
                  orderId: order.id,
                  paymentId: payment.id
                });
              }
            } catch (emailError) {
              const logger = require('../utils/logger');
              logger.logEmailFailure({
                emailType: 'payment_confirmation',
                recipient: order.user?.email,
                error: emailError.message,
                orderId: order.id,
                paymentId: payment.id
              });
              
              console.error('Callback processing: Failed to send confirmation email:', emailError.message);
            }

            // Task 14.4: Update seller analytics with revenue and order count
            try {
              const OrderItem = require('../models').OrderItem;
              const Seller = require('../models').Seller;
              
              // Get all order items for this order
              const orderItems = await OrderItem.findAll({ 
                where: { order_id: order.id },
                attributes: ['id', 'seller_id', 'price_at_purchase', 'quantity']
              });
              
              console.log(`Callback processing: Updating analytics for ${orderItems.length} order items`);
              
              // Group items by seller to update each seller once per order
              const sellerRevenue = {};
              const sellerOrders = new Set();
              
              for (const item of orderItems) {
                if (item.seller_id) {
                  const revenue = parseFloat(item.price_at_purchase) * item.quantity;
                  
                  // Accumulate revenue per seller
                  if (!sellerRevenue[item.seller_id]) {
                    sellerRevenue[item.seller_id] = 0;
                  }
                  sellerRevenue[item.seller_id] += revenue;
                  
                  // Track unique sellers for order count
                  sellerOrders.add(item.seller_id);
                }
              }
              
              // Update each seller's analytics
              for (const sellerId of Object.keys(sellerRevenue)) {
                const revenue = sellerRevenue[sellerId];
                
                const seller = await Seller.findByPk(sellerId);
                if (seller) {
                  // Increment total_revenue and total_orders
                  await seller.increment({
                    total_revenue: revenue,
                    total_orders: 1
                  });
                  
                  console.log(`Callback processing: Updated seller ${sellerId} analytics: +${revenue.toFixed(2)} revenue, +1 order`);
                } else {
                  console.warn(`Callback processing: Seller ${sellerId} not found for analytics update`);
                }
              }
              
              console.log(`Callback processing: Successfully updated analytics for ${sellerOrders.size} sellers`);
            } catch (analyticsError) {
              console.error('Callback processing: Failed to update seller analytics:', analyticsError.message);
              console.error(analyticsError.stack);
            }

            console.log(`Callback processing: Payment verified and order ${order.id} confirmed for tx_ref ${tx_ref}`);
          } else {
            // Order already paid, commit transaction and return
            await transaction.commit();
            console.log(`Callback processing: Payment verified but order ${order.id} already paid for tx_ref ${tx_ref}`);
          }
        } else if (verificationResult.status === 'failed') {
          // Task 7.6: Update payment record with failure
          payment.status = 'failed';
          payment.chapa_response = verificationResult;
          await payment.save({ transaction });

          // Task 7.7: Update order status
          const order = payment.order;
          if (order && order.payment_status !== 'failed') {
            order.payment_status = 'failed';
            order.order_status = 'pending';
            await order.save({ transaction });
          }

          // Commit transaction before logging
          await transaction.commit();

          // Log payment failure
          securityLogger.logPaymentFailure({
            paymentId: payment.id,
            orderId: order?.id,
            reference: tx_ref,
            amount: payment.amount,
            reason: verificationResult.message || 'Payment failed'
          });

          console.log(`Callback processing: Payment verification failed for tx_ref ${tx_ref}`);
        } else {
          // Unknown status, rollback transaction
          await transaction.rollback();
          console.log(`Callback processing: Unknown verification status for tx_ref ${tx_ref}: ${verificationResult.status}`);
        }

        // Record metrics
        const duration = Date.now() - startTime;
        paymentMetrics.recordWebhookDelivery(true, { txRef: tx_ref });
        paymentMetrics.recordResponseTime(duration, 'callback');
      } catch (verifyError) {
        // Task 7.9: Add error handling for verification failures
        // Rollback transaction on error
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }
        
        // Determine error type and severity
        const errorType = verifyError.name || 'UnknownError';
        const errorMessage = verifyError.message || 'Unknown error occurred';
        const isNetworkError = errorType === 'NetworkError' || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT');
        const isTimeoutError = errorType === 'TimeoutError' || errorMessage.includes('timeout');
        const isValidationError = errorType === 'ValidationError' || errorMessage.includes('validation');
        
        // Log detailed error information
        console.error(`Callback processing: Async verification failed for tx_ref ${tx_ref}`);
        console.error(`Error Type: ${errorType}`);
        console.error(`Error Message: ${errorMessage}`);
        console.error(`Stack Trace:`, verifyError.stack);
        
        // Log to security logger with error details
        securityLogger.logVerificationFailure({
          txRef: tx_ref,
          errorType,
          errorMessage,
          isNetworkError,
          isTimeoutError,
          isValidationError,
          timestamp: new Date().toISOString(),
          stackTrace: verifyError.stack
        });
        
        // Record failure metrics with detailed reason
        paymentMetrics.recordWebhookDelivery(false, { 
          txRef: tx_ref, 
          reason: errorMessage,
          errorType,
          isRetryable: isNetworkError || isTimeoutError
        });
        
        // Attempt to update payment record with error status
        try {
          const failedPayment = await Payment.findOne({
            where: { chapa_tx_ref: tx_ref }
          });
          
          if (failedPayment && failedPayment.status === 'pending') {
            // Mark payment as verification_failed for manual review
            failedPayment.status = 'verification_failed';
            failedPayment.chapa_response = {
              error: errorMessage,
              errorType,
              timestamp: new Date().toISOString(),
              requiresManualReview: true
            };
            await failedPayment.save();
            
            console.log(`Callback processing: Payment ${failedPayment.id} marked as verification_failed for manual review`);
            
            // Log for admin notification
            securityLogger.logManualReviewRequired({
              paymentId: failedPayment.id,
              txRef: tx_ref,
              reason: 'Verification failed during callback processing',
              errorMessage
            });
          }
        } catch (updateError) {
          console.error(`Callback processing: Failed to update payment record after verification error:`, updateError.message);
          
          // Log critical error - payment is in inconsistent state
          securityLogger.logCriticalError({
            context: 'callback_verification_failure',
            txRef: tx_ref,
            originalError: errorMessage,
            updateError: updateError.message,
            requiresUrgentAttention: true
          });
        }
        
        // If network or timeout error, log for retry consideration
        if (isNetworkError || isTimeoutError) {
          console.log(`Callback processing: Transient error detected for tx_ref ${tx_ref}. Payment may be retried by Chapa.`);
          
          securityLogger.logRetryableError({
            txRef: tx_ref,
            errorType,
            errorMessage,
            timestamp: new Date().toISOString()
          });
        }
      }
    });
  } catch (error) {
    console.error('Callback processing error:', error);
    
    // Still acknowledge receipt even on error
    if (!res.headersSent) {
      res.status(200).json({
        success: true,
        message: 'Callback received with errors',
        error: error.message
      });
    }
  }
};
/**
 * Handle Chapa return URL
 * GET /api/payments/return
 * Requirements: Return URL handling with HTML response for Flutter WebView
 * Task 9.1: Create handleReturn function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleReturn = async (req, res) => {
  try {
    // Task 9.2: Parse query parameters (tx_ref, status) from return URL
    const { tx_ref, status } = req.query;

    // Task 9.5: Log return URL access with tx_ref and status
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Return URL accessed: tx_ref=${tx_ref}, status=${status}`);

    // Log return URL access (commented out - method not implemented in securityLogger yet)
    // securityLogger.logReturnUrlAccess({
    //   txRef: tx_ref,
    //   status,
    //   ip: req.ip,
    //   timestamp,
    //   userAgent: req.headers['user-agent']
    // });

    // Task 9.3: Return HTML page that signals Flutter WebView to close
    // Task 9.4: Add JavaScript to post message to Flutter WebView
    const htmlResponse = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Processing</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
    }
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 10px 0;
      font-weight: 600;
    }
    p {
      font-size: 16px;
      margin: 0 0 20px 0;
      opacity: 0.9;
    }
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 3px solid white;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .reference {
      font-size: 12px;
      opacity: 0.7;
      margin-top: 20px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✓</div>
    <h1>Payment Processing</h1>
    <p>Please wait while we verify your payment...</p>
    <div class="spinner"></div>
    ${tx_ref ? `<div class="reference">Reference: ${tx_ref}</div>` : ''}
  </div>

  <script>
    // Task 9.4: Post message to Flutter WebView to signal closure
    (function() {
      const txRef = '${tx_ref || ''}';
      const status = '${status || 'unknown'}';

      console.log('Return URL page loaded:', { txRef, status });

      // Method 1: Use JavaScript channel for webview_flutter package
      if (window.PaymentReturn) {
        console.log('Posting message to PaymentReturn channel');
        window.PaymentReturn.postMessage('tx_ref:' + txRef + ',status:' + status);
      }

      // Method 2: Post message to Flutter WebView using flutter_inappwebview
      if (window.flutter_inappwebview) {
        console.log('Calling flutter_inappwebview handler');
        window.flutter_inappwebview.callHandler('paymentReturn', {
          tx_ref: txRef,
          status: status,
          timestamp: new Date().toISOString()
        });
      }

      // Method 3: Try postMessage for webview_flutter package (alternative)
      if (window.parent) {
        console.log('Posting message to parent window');
        window.parent.postMessage({
          type: 'PAYMENT_RETURN',
          tx_ref: txRef,
          status: status,
          timestamp: new Date().toISOString()
        }, '*');
      }

      // Fallback: Try to close the window after a short delay
      setTimeout(function() {
        console.log('Attempting to close window...');

        // Try multiple methods to signal completion
        if (window.close) {
          window.close();
        }

        // Signal to any parent frame
        if (window.parent !== window) {
          window.parent.postMessage('CLOSE_WEBVIEW', '*');
        }

        // Update UI to show manual close instruction
        document.querySelector('.container').innerHTML =
          '<div class="icon">✓</div>' +
          '<h1>Payment Received</h1>' +
          '<p>You can now close this window and return to the app.</p>' +
          (txRef ? '<div class="reference">Reference: ' + txRef + '</div>' : '');
      }, 2000);
    })();
  </script>
</body>
</html>
    `;

    // Task 9.6: Test return URL handler returns proper HTML response
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlResponse);
  } catch (error) {
    console.error('Return URL processing error:', error);

    // Return error page
    const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      text-align: center;
    }
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 10px 0;
      font-weight: 600;
    }
    p {
      font-size: 16px;
      margin: 0;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠</div>
    <h1>Processing Error</h1>
    <p>An error occurred while processing your payment return. Please contact support if needed.</p>
  </div>
  <script>
    // Still try to close the window
    setTimeout(function() {
      if (window.close) window.close();
      if (window.parent !== window) {
        window.parent.postMessage('CLOSE_WEBVIEW', '*');
      }
    }, 3000);
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(errorHtml);
  }
};

/**
 * Get payment status by transaction reference
 * GET /api/payments/status/:tx_ref
 * Requirements: 11.1, 11.2, 11.3, 11.4
 * Task 11.1: Create getPaymentStatus function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentStatus = async (req, res) => {
  try {
    // Task 11.2: Accept tx_ref as parameter
    const { tx_ref } = req.params;

    if (!tx_ref) {
      return res.status(400).json({
        success: false,
        message: 'Transaction reference is required'
      });
    }

    // Task 11.3: Query payment record by tx_ref with comprehensive order details
    const payment = await Payment.findOne({
      where: { chapa_tx_ref: tx_ref },
      include: [{
        model: Order,
        as: 'order',
        attributes: [
          'id', 'order_number', 'subtotal', 'shipping_cost', 'tax_amount', 
          'discount_amount', 'total_amount', 'order_status', 'payment_status', 
          'payment_method', 'shipping_address', 'notes', 'tracking_number', 
          'carrier', 'estimated_delivery_date', 'paid_at', 'delivered_at', 
          'created_at', 'updated_at'
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'first_name', 'last_name', 'phone']
          },
          {
            model: OrderItem,
            as: 'items',
            attributes: ['id', 'quantity', 'price_at_purchase', 'status'],
            include: [{
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'description', 'images', 'sku']
            }]
          }
        ]
      }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
        error: `No payment found for transaction reference: ${tx_ref}`
      });
    }

    // Task 11.4: Return payment status, amount, and comprehensive order details
    res.status(200).json({
      success: true,
      message: 'Payment status retrieved successfully',
      data: {
        payment: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount.toString(),
          currency: payment.currency,
          paymentMethod: payment.payment_method,
          transactionId: payment.transaction_id,
          chapaReference: payment.chapa_tx_ref,
          paidAt: payment.paid_at,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at
        },
        order: payment.order ? {
          id: payment.order.id,
          orderNumber: payment.order.order_number,
          subtotal: payment.order.subtotal?.toString(),
          shippingCost: payment.order.shipping_cost?.toString(),
          taxAmount: payment.order.tax_amount?.toString(),
          discountAmount: payment.order.discount_amount?.toString(),
          totalAmount: payment.order.total_amount.toString(),
          orderStatus: payment.order.order_status,
          paymentStatus: payment.order.payment_status,
          paymentMethod: payment.order.payment_method,
          notes: payment.order.notes,
          trackingNumber: payment.order.tracking_number,
          carrier: payment.order.carrier,
          estimatedDeliveryDate: payment.order.estimated_delivery_date,
          paidAt: payment.order.paid_at,
          deliveredAt: payment.order.delivered_at,
          createdAt: payment.order.created_at,
          updatedAt: payment.order.updated_at,
          customer: {
            id: payment.order.user?.id,
            email: payment.order.user?.email,
            firstName: payment.order.user?.first_name,
            lastName: payment.order.user?.last_name,
            phone: payment.order.user?.phone
          },
          shippingAddress: payment.order.shipping_address,
          items: payment.order.items?.map(item => ({
            id: item.id,
            quantity: item.quantity,
            priceAtPurchase: item.price_at_purchase?.toString(),
            status: item.status,
            product: item.product ? {
              id: item.product.id,
              name: item.product.name,
              description: item.product.description,
              images: item.product.images,
              sku: item.product.sku
            } : null
          })) || []
        } : null
      }
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment status',
      error: error.message
    });
  }
};

module.exports = {
  initiatePayment,
  handleWebhook,
  handleCallback,
  handleReturn,
  verifyPayment,
  getPaymentStatus,
  getPaymentHistory,
  adminVerifyPayment
};
