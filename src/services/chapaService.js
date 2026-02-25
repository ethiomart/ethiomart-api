const axios = require('axios');
const crypto = require('crypto');
const chapaConfig = require('../config/chapa');
const emailService = require('./emailService');

/**
 * Circuit Breaker for Chapa API calls
 */
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - Chapa API temporarily unavailable');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.error(`Circuit breaker opened after ${this.failureCount} failures. Will retry after ${this.timeout}ms`);
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }
}

// Create circuit breaker instance
const chapaCircuitBreaker = new CircuitBreaker(5, 60000);

/**
 * Check if error is retryable (5xx or network errors)
 * @param {Error} error - The error object
 * @returns {boolean} - True if error is retryable
 */
function isRetryableError(error) {
  // Network errors
  if (error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT' || 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND') {
    return true;
  }

  // 5xx server errors
  if (error.response && error.response.status >= 500) {
    return true;
  }

  // 4xx client errors should not be retried
  return false;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<any>} - Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Only retry on retryable errors
      if (!isRetryableError(error)) {
        console.log(`Non-retryable error on attempt ${attempt}: ${error.message}`);
        throw error;
      }

      // Calculate exponential backoff delay: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`Retryable error on attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
      console.log(`Error: ${error.message}`);

      await sleep(delay);
    }
  }

  // All retries exhausted
  console.error(`All ${maxRetries} retry attempts failed`);
  throw lastError;
}

/**
 * Initialize a payment with Chapa
 * @param {string} orderId - The order ID
 * @param {number} amount - The payment amount
 * @param {string} email - Customer email
 * @param {string} firstName - Customer first name
 * @param {string} lastName - Customer last name
 * @param {string} phoneNumber - Customer phone number (optional)
 * @param {string} paymentMethod - Preferred payment method (optional)
 * @returns {Promise<{paymentUrl: string, reference: string, paymentMethods: array}>}
 */
async function initializePayment(orderId, amount, email, firstName, lastName, phoneNumber = null, paymentMethod = null) {
  try {
    // Generate a unique transaction reference
    const txRef = `order-${orderId}-${Date.now()}`;

    // Prepare payment request payload
    const payload = {
      amount: amount.toString(),
      currency: chapaConfig.currency,
      email,
      first_name: firstName,
      last_name: lastName,
      tx_ref: txRef,
      callback_url: chapaConfig.callbackUrl,
      return_url: chapaConfig.returnUrl,
      customization: {
        title: 'Multi-Vendor E-Commerce',
        description: `Payment for order #${orderId}`,
        logo: process.env.MERCHANT_LOGO_URL || ''
      },
      meta: {
        order_id: orderId,
        customer_email: email,
        create_customer_profile: chapaConfig.createCustomerProfile
      }
    };

    // Add phone number if provided (for mobile money)
    if (phoneNumber) {
      payload.phone_number = phoneNumber;
    }

    // Add preferred payment method if specified
    if (paymentMethod) {
      payload.payment_method = paymentMethod;
    }

    // Make POST request to Chapa API with retry and circuit breaker
    const response = await chapaCircuitBreaker.execute(async () => {
      return await retryWithBackoff(async () => {
        return await axios.post(
          `${chapaConfig.apiUrl}/transaction/initialize`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${chapaConfig.secretKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
      }, 3); // 3 retries with exponential backoff (1s, 2s, 4s)
    });

    // Extract payment URL and reference from response
    if (response.data && response.data.status === 'success') {
      // Send notification to finance email
      try {
        await emailService.sendEmail(
          chapaConfig.financeEmail,
          'New Payment Initiated',
          `
            <h2>Payment Initiated</h2>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Amount:</strong> ${amount} ${chapaConfig.currency}</p>
            <p><strong>Customer:</strong> ${firstName} ${lastName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Reference:</strong> ${txRef}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          `
        );
      } catch (emailError) {
        console.error('Failed to send finance notification:', emailError.message);
      }

      return {
        paymentUrl: response.data.data.checkout_url,
        reference: txRef,
        paymentMethods: chapaConfig.paymentMethods,
        currency: chapaConfig.currency
      };
    } else {
      throw new Error('Failed to initialize payment with Chapa');
    }
  } catch (error) {
    console.error('Chapa payment initialization error:', error.response?.data || error.message);
    
    // Send error notification to finance email
    try {
      await emailService.sendEmail(
        chapaConfig.financeEmail,
        'Payment Initialization Failed',
        `
          <h2>Payment Initialization Error</h2>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Amount:</strong> ${amount} ${chapaConfig.currency}</p>
          <p><strong>Customer:</strong> ${firstName} ${lastName}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `
      );
    } catch (emailError) {
      console.error('Failed to send error notification:', emailError.message);
    }
    
    throw new Error(`Payment initialization failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Verify a payment with Chapa
 * @param {string} reference - The transaction reference
 * @returns {Promise<{status: string, amount: number, currency: string, reference: string, customerProfile: object}>}
 */
async function verifyPayment(reference) {
  try {
    // Make GET request to Chapa API to verify payment with retry and circuit breaker
    const response = await chapaCircuitBreaker.execute(async () => {
      return await retryWithBackoff(async () => {
        return await axios.get(
          `${chapaConfig.apiUrl}/transaction/verify/${reference}`,
          {
            headers: {
              'Authorization': `Bearer ${chapaConfig.secretKey}`
            },
            timeout: 30000
          }
        );
      }, 3); // 3 retries with exponential backoff (1s, 2s, 4s)
    });

    // Extract payment details from response
    if (response.data && response.data.status === 'success') {
      const data = response.data.data;
      
      const paymentDetails = {
        status: data.status, // 'success' or 'failed'
        amount: parseFloat(data.amount),
        currency: data.currency,
        reference: data.tx_ref,
        paymentMethod: data.payment_method || 'unknown',
        customerProfile: data.customer || null,
        transactionId: data.id || null,
        chargedAmount: parseFloat(data.charge) || 0
      };

      // Send receipt to customer if payment successful
      if (data.status === 'success' && chapaConfig.sendReceiptsToCustomers) {
        try {
          await emailService.sendPaymentReceipt({
            email: data.email,
            firstName: data.first_name,
            lastName: data.last_name,
            amount: data.amount,
            currency: data.currency,
            reference: data.tx_ref,
            paymentMethod: data.payment_method,
            transactionDate: new Date().toLocaleString()
          });
        } catch (emailError) {
          console.error('Failed to send customer receipt:', emailError.message);
        }
      }

      // Send transaction notification to finance email
      if (chapaConfig.sendTransactionReceipts) {
        try {
          await emailService.sendEmail(
            chapaConfig.financeEmail,
            `Payment ${data.status === 'success' ? 'Successful' : 'Failed'}`,
            `
              <h2>Payment ${data.status === 'success' ? 'Completed' : 'Failed'}</h2>
              <p><strong>Status:</strong> ${data.status}</p>
              <p><strong>Amount:</strong> ${data.amount} ${data.currency}</p>
              <p><strong>Customer:</strong> ${data.first_name} ${data.last_name}</p>
              <p><strong>Email:</strong> ${data.email}</p>
              <p><strong>Payment Method:</strong> ${data.payment_method || 'N/A'}</p>
              <p><strong>Reference:</strong> ${data.tx_ref}</p>
              <p><strong>Transaction ID:</strong> ${data.id || 'N/A'}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `
          );
        } catch (emailError) {
          console.error('Failed to send finance notification:', emailError.message);
        }
      }

      return paymentDetails;
    } else {
      throw new Error('Failed to verify payment with Chapa');
    }
  } catch (error) {
    console.error('Chapa payment verification error:', error.response?.data || error.message);
    throw new Error(`Payment verification failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Verify webhook signature from Chapa
 * @param {object} payload - The webhook payload
 * @param {string} signature - The signature from Chapa webhook header
 * @returns {boolean} - True if signature is valid, false otherwise
 */
function verifyWebhookSignature(payload, signature) {
  try {
    if (!chapaConfig.webhookSecret) {
      console.warn('Webhook secret not configured, skipping signature verification');
      return true; // Allow in test mode
    }

    // Convert payload to string if it's an object
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Generate HMAC SHA256 hash using webhook secret
    const hash = crypto
      .createHmac('sha256', chapaConfig.webhookSecret)
      .update(payloadString)
      .digest('hex');

    // Compare generated hash with provided signature
    return hash === signature;
  } catch (error) {
    console.error('Webhook signature verification error:', error.message);
    return false;
  }
}

/**
 * Get available payment methods
 * @returns {array} - List of enabled payment methods
 */
function getPaymentMethods() {
  return chapaConfig.paymentMethods;
}

/**
 * Get payment method details by ID
 * @param {string} methodId - Payment method ID
 * @returns {object|null} - Payment method details or null
 */
function getPaymentMethodById(methodId) {
  return chapaConfig.paymentMethods.find(method => method.id === methodId) || null;
}

/**
 * Check if retry is allowed for a failed payment
 * @param {Date} lastAttemptTime - Time of last payment attempt
 * @returns {boolean} - True if retry is allowed
 */
function canRetryPayment(lastAttemptTime) {
  if (!chapaConfig.retryEnabled) {
    return false;
  }

  const now = new Date();
  const lastAttempt = new Date(lastAttemptTime);
  const minutesSinceLastAttempt = (now - lastAttempt) / (1000 * 60);

  return minutesSinceLastAttempt >= chapaConfig.retryInterval;
}

/**
 * Export transaction report
 * @param {Date} startDate - Start date for report
 * @param {Date} endDate - End date for report
 * @param {array} transactions - Array of transaction objects
 * @returns {Promise<void>}
 */
async function exportTransactionReport(startDate, endDate, transactions) {
  try {
    // Generate CSV content
    const csvHeader = 'Date,Reference,Order ID,Customer,Amount,Currency,Status,Payment Method\n';
    const csvRows = transactions.map(tx => 
      `${tx.createdAt},${tx.chapaReference},${tx.orderId},${tx.customerEmail},${tx.amount},${tx.currency || 'ETB'},${tx.status},${tx.paymentMethod || 'N/A'}`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;

    // Calculate summary
    const totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const successfulPayments = transactions.filter(tx => tx.status === 'success').length;
    const failedPayments = transactions.filter(tx => tx.status === 'failed').length;

    // Send report email
    await emailService.sendEmail(
      chapaConfig.exportEmail,
      `Transaction Report: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      `
        <h2>Transaction Report</h2>
        <p><strong>Period:</strong> ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</p>
        <p><strong>Total Transactions:</strong> ${transactions.length}</p>
        <p><strong>Successful:</strong> ${successfulPayments}</p>
        <p><strong>Failed:</strong> ${failedPayments}</p>
        <p><strong>Total Amount:</strong> ${totalAmount.toFixed(2)} ETB</p>
        <p>Detailed report is attached as CSV.</p>
      `,
      [{
        filename: `transactions_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`,
        content: csvContent
      }]
    );

    console.log('Transaction report exported successfully');
  } catch (error) {
    console.error('Failed to export transaction report:', error.message);
    throw error;
  }
}

module.exports = {
  initializePayment,
  verifyPayment,
  verifyWebhookSignature,
  getPaymentMethods,
  getPaymentMethodById,
  canRetryPayment,
  exportTransactionReport,
  retryWithBackoff,
  chapaCircuitBreaker,
  isRetryableError
};
