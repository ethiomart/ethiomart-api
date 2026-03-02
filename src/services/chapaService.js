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
 * Sanitize phone number for Chapa (Expected: 2519..., 09..., or 07...)
 * @param {string} phone - Original phone number
 * @returns {string|null} - Sanitized phone number or null
 */
function sanitizePhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-numeric characters
  let sanitized = phone.replace(/\D/g, '');
  
  // Handle 251 country code - Chapa often prefers local 09... format for mobile money
  if (sanitized.length === 12 && sanitized.startsWith('251')) {
    return '0' + sanitized.substring(3);
  }
  
  // Handle local 09... or 07... (10 digits)
  if (sanitized.length === 10 && (sanitized.startsWith('09') || sanitized.startsWith('07'))) {
    return sanitized;
  }

  // If it's 9 digits starting with 9 or 7, prepend 0
  if (sanitized.length === 9 && (sanitized.startsWith('9') || sanitized.startsWith('7'))) {
    return '0' + sanitized;
  }
  
  return sanitized;
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
    // Read and validate callback_url from environment
    const callbackUrl = process.env.CHAPA_CALLBACK_URL;
    if (!callbackUrl) {
      const errorMsg = 'CHAPA_CALLBACK_URL is not configured in environment variables. Please set CHAPA_CALLBACK_URL in your .env file (e.g., https://yourdomain.com/api/payments/callback)';
      console.error('Payment initialization failed:', {
        error: 'Missing callback URL configuration',
        orderId,
        timestamp: new Date().toISOString()
      });
      throw new Error(errorMsg);
    }
    
    // Validate callback URL is absolute and properly formatted
    try {
      const callbackUrlObj = new URL(callbackUrl);
      if (!callbackUrlObj.protocol || !callbackUrlObj.hostname) {
        throw new Error('CHAPA_CALLBACK_URL must be a valid absolute URL with protocol and hostname');
      }
      // Ensure HTTPS in production
      if (process.env.NODE_ENV === 'production' && callbackUrlObj.protocol !== 'https:') {
        const errorMsg = 'CHAPA_CALLBACK_URL must use HTTPS in production environment for security. Current URL uses: ' + callbackUrlObj.protocol;
        console.error('Payment initialization failed:', {
          error: 'Insecure callback URL in production',
          protocol: callbackUrlObj.protocol,
          orderId,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorMsg);
      }
    } catch (urlError) {
      const errorMsg = `Invalid CHAPA_CALLBACK_URL format: ${urlError.message}. Expected format: https://yourdomain.com/api/payments/callback`;
      console.error('Payment initialization failed:', {
        error: 'Invalid callback URL format',
        callbackUrl,
        urlError: urlError.message,
        orderId,
        timestamp: new Date().toISOString()
      });
      throw new Error(errorMsg);
    }

    // Read and validate return_url from environment
    const returnUrl = process.env.CHAPA_RETURN_URL;
    if (!returnUrl) {
      const errorMsg = 'CHAPA_RETURN_URL is not configured in environment variables. Please set CHAPA_RETURN_URL in your .env file (e.g., https://yourdomain.com/api/payments/return)';
      console.error('Payment initialization failed:', {
        error: 'Missing return URL configuration',
        orderId,
        timestamp: new Date().toISOString()
      });
      throw new Error(errorMsg);
    }
    
    // Validate return URL is absolute and properly formatted
    try {
      const returnUrlObj = new URL(returnUrl);
      if (!returnUrlObj.protocol || !returnUrlObj.hostname) {
        throw new Error('CHAPA_RETURN_URL must be a valid absolute URL with protocol and hostname');
      }

      // 🚨 DOMAIN WARNING (For developers) 🚨
      const suspectedDomains = ['ethiomart.com', 'api.ethiomart.com'];
      if (suspectedDomains.includes(returnUrlObj.hostname)) {
        console.warn(`\n⚠️  [CHAPA WARNING] Your return_url uses '${returnUrlObj.hostname}'.`);
        console.warn(`If you are testing locally AND seeing "Unauthorized domain detected",`);
        console.warn(`ensure this domain is whitelisted in your Chapa Dashboard (https://dashboard.chapa.co/settings/api).\n`);
      }

      // Ensure HTTPS in production
      if (process.env.NODE_ENV === 'production' && returnUrlObj.protocol !== 'https:') {
        const errorMsg = 'CHAPA_RETURN_URL must use HTTPS in production environment for security. Current URL uses: ' + returnUrlObj.protocol;
        console.error('Payment initialization failed:', {
          error: 'Insecure return URL in production',
          protocol: returnUrlObj.protocol,
          orderId,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorMsg);
      }
    } catch (urlError) {
      const errorMsg = `Invalid CHAPA_RETURN_URL format: ${urlError.message}. Expected format: https://yourdomain.com/api/payments/return`;
      console.error('Payment initialization failed:', {
        error: 'Invalid return URL format',
        returnUrl,
        urlError: urlError.message,
        orderId,
        timestamp: new Date().toISOString()
      });
      throw new Error(errorMsg);
    }

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
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: {
        title: 'EthioMart',
        description: `Order ${orderId}`,
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
      payload.phone_number = sanitizePhoneNumber(phoneNumber);
    }

    // Add preferred payment method if specified
    if (paymentMethod) {
      payload.payment_method = paymentMethod;
    }

    // ============================================
    // REQUEST PAYLOAD LOGGING (Task 16.4)
    // ============================================
    // Log payment initialization request (excluding sensitive data)
    // Note: Customer email, phone, and full names are excluded for privacy
    // Amount is only logged in non-production environments
    const logData = {
      orderId,
      currency: payload.currency,
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      payment_method: paymentMethod || 'default',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      // Request metadata
      request_url: `${chapaConfig.apiUrl}/transaction/initialize`,
      request_method: 'POST',
      has_phone_number: !!phoneNumber,
      has_payment_method: !!paymentMethod
    };

    // Only log amount and customer initials in non-production environments for security
    if (process.env.NODE_ENV !== 'production') {
      logData.amount = payload.amount;
      logData.customer_initials = `${firstName.charAt(0)}.${lastName.charAt(0)}.`;
      // Log sanitized request payload structure (non-production only)
      logData.request_payload_structure = {
        amount: 'string',
        currency: payload.currency,
        email: 'REDACTED',
        first_name: 'REDACTED',
        last_name: 'REDACTED',
        tx_ref: txRef,
        callback_url: 'configured',
        return_url: 'configured',
        phone_number: phoneNumber ? 'provided' : 'not_provided',
        payment_method: paymentMethod || 'not_specified',
        customization: 'configured',
        meta: 'configured'
      };
    }

    console.log('=== PAYMENT INITIALIZATION REQUEST ===');
    console.log('Request Details:', JSON.stringify(logData, null, 2));
    console.log('======================================');

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

    // ============================================
    // RESPONSE STATUS AND BODY LOGGING (Task 16.5)
    // ============================================
    // Log payment initialization response (excluding sensitive data)
    const responseLogData = {
      orderId,
      tx_ref: txRef,
      response_status: response.status,
      response_status_text: response.statusText,
      response_data_status: response.data?.status,
      response_message: response.data?.message,
      has_checkout_url: !!response.data?.data?.checkout_url,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      // Response metadata
      response_headers: {
        'content-type': response.headers['content-type'],
        'x-request-id': response.headers['x-request-id']
      }
    };

    // Only log full response body structure in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      responseLogData.response_body_structure = {
        status: response.data?.status,
        message: response.data?.message,
        data: response.data?.data ? {
          checkout_url: 'present',
          tx_ref: response.data.data.tx_ref || 'not_present'
        } : 'not_present'
      };
    }

    console.log('=== PAYMENT INITIALIZATION RESPONSE ===');
    console.log('Response Details:', JSON.stringify(responseLogData, null, 2));
    console.log('=======================================');

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
        // Silent failure for email - don't let email issues break the payment flow
        console.warn('📧 [NON-BLOCKING] Failed to send finance notification:', emailError.message);
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
    // Log detailed error information (excluding sensitive data)
    // Note: Customer email, phone, and full names are excluded for privacy
    // Amount is only logged in non-production environments
    const errorLogData = {
      orderId,
      currency: chapaConfig.currency,
      errorMessage: error.message,
      errorType: error.name || 'Unknown',
      errorCode: error.code,
      errorStatus: error.response?.status,
      errorStatusText: error.response?.statusText,
      errorData: error.response?.data,
      errorHeaders: error.response?.headers ? {
        'content-type': error.response.headers['content-type'],
        'x-request-id': error.response.headers['x-request-id']
      } : undefined,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method?.toUpperCase(),
      requestTimeout: error.config?.timeout,
      isRetryableError: isRetryableError(error),
      circuitBreakerState: chapaCircuitBreaker.getState(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Only log amount and customer initials in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      errorLogData.amount = amount;
      errorLogData.customer_initials = `${firstName.charAt(0)}.${lastName.charAt(0)}.`;
      errorLogData.requestPayload = {
        currency: chapaConfig.currency,
        tx_ref: `order-${orderId}-${Date.now()}`,
        callback_url: process.env.CHAPA_CALLBACK_URL,
        return_url: process.env.CHAPA_RETURN_URL
      };
    }

    // Log comprehensive error details
    console.error('=== CHAPA API ERROR - Payment Initialization ===');
    console.error('Error Details:', JSON.stringify(errorLogData, null, 2));
    
    // Log specific error categories for easier debugging
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection Error: Unable to reach Chapa API server. Check network connectivity and API URL.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Timeout Error: Chapa API request timed out. The server may be slow or unresponsive.');
    } else if (error.response?.status === 401) {
      console.error('Authentication Error: Invalid or missing Chapa API secret key. Verify CHAPA_SECRET_KEY in environment.');
    } else if (error.response?.status === 400) {
      console.error('Validation Error: Invalid request payload. Check required fields and data formats.');
      if (error.response?.data?.errors) {
        console.error('Field Errors:', JSON.stringify(error.response.data.errors, null, 2));
      }
    } else if (error.response?.status === 429) {
      console.error('Rate Limit Error: Too many requests to Chapa API. Implement rate limiting or retry with backoff.');
    } else if (error.response?.status >= 500) {
      console.error('Server Error: Chapa API server error. This is typically temporary - retry may succeed.');
    }
    
    console.error('=== END CHAPA API ERROR ===');

    console.error('Chapa payment initialization error:', errorLogData);
    
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
    
    // Ultra-robust error formatting
    let errorMessage = error.message;
    
    if (error.response?.data) {
      try {
        errorMessage = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data);
      } catch (e) {
        errorMessage = 'Could not stringify error data: ' + error.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Log to a local file for emergency debugging on user's system
    try {
      const fs = require('fs');
      const path = require('path');
      const logFile = path.join(process.cwd(), 'chapa_debug.log');
      const logEntry = `\n--- ${new Date().toISOString()} ---\n` +
                       `Order ID: ${orderId}\n` +
                       `Error: ${error.message}\n` +
                       `Response Data: ${JSON.stringify(error.response?.data, null, 2)}\n` +
                       `---------------------------\n`;
      fs.appendFileSync(logFile, logEntry);
      console.log(`Chapa debug info written to ${logFile}`);
    } catch (logErr) {
      console.error('Failed to write to debug log:', logErr.message);
    }
    
    console.error('!!!ANTIGRAVITY_CHAPA_ERROR_FINAL!!!', errorMessage);
    throw new Error(`Payment initialization failed: ${errorMessage}`);
  }
}

/**
 * Verify a payment with Chapa
 * @param {string} reference - The transaction reference
 * @returns {Promise<{status: string, amount: number, currency: string, reference: string, customerProfile: object}>}
 */
async function verifyPayment(reference) {
  try {
    // ============================================
    // REQUEST PAYLOAD LOGGING (Task 16.4)
    // ============================================
    // Log payment verification request (excluding sensitive data)
    const logData = {
      reference,
      request_url: `${chapaConfig.apiUrl}/transaction/verify/${reference}`,
      request_method: 'GET',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };

    console.log('=== PAYMENT VERIFICATION REQUEST ===');
    console.log('Request Details:', JSON.stringify(logData, null, 2));
    console.log('====================================');

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

    // ============================================
    // RESPONSE STATUS AND BODY LOGGING (Task 16.5)
    // ============================================
    // Log payment verification response (excluding sensitive data)
    const responseLogData = {
      reference,
      response_status: response.status,
      response_status_text: response.statusText,
      response_data_status: response.data?.status,
      response_message: response.data?.message,
      payment_status: response.data?.data?.status,
      payment_method: response.data?.data?.payment_method,
      has_customer_data: !!response.data?.data?.customer,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      // Response metadata
      response_headers: {
        'content-type': response.headers['content-type'],
        'x-request-id': response.headers['x-request-id']
      }
    };

    // Only log amount and full response structure in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      responseLogData.amount = response.data?.data?.amount;
      responseLogData.currency = response.data?.data?.currency;
      responseLogData.response_body_structure = {
        status: response.data?.status,
        message: response.data?.message,
        data: response.data?.data ? {
          status: response.data.data.status,
          amount: 'present',
          currency: response.data.data.currency,
          tx_ref: response.data.data.tx_ref || 'not_present',
          payment_method: response.data.data.payment_method || 'not_present',
          customer: response.data.data.customer ? 'present' : 'not_present',
          id: response.data.data.id || 'not_present'
        } : 'not_present'
      };
    }

    console.log('=== PAYMENT VERIFICATION RESPONSE ===');
    console.log('Response Details:', JSON.stringify(responseLogData, null, 2));
    console.log('=====================================');

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
    // Log detailed error information for payment verification
    const errorLogData = {
      reference,
      errorMessage: error.message,
      errorType: error.name || 'Unknown',
      errorCode: error.code,
      errorStatus: error.response?.status,
      errorStatusText: error.response?.statusText,
      errorData: error.response?.data,
      errorHeaders: error.response?.headers ? {
        'content-type': error.response.headers['content-type'],
        'x-request-id': error.response.headers['x-request-id']
      } : undefined,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method?.toUpperCase(),
      requestTimeout: error.config?.timeout,
      isRetryableError: isRetryableError(error),
      circuitBreakerState: chapaCircuitBreaker.getState(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Log comprehensive error details
    console.error('=== CHAPA API ERROR - Payment Verification ===');
    console.error('Error Details:', JSON.stringify(errorLogData, null, 2));
    
    // Log specific error categories for easier debugging
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection Error: Unable to reach Chapa API server. Check network connectivity and API URL.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Timeout Error: Chapa API request timed out. The server may be slow or unresponsive.');
    } else if (error.response?.status === 401) {
      console.error('Authentication Error: Invalid or missing Chapa API secret key. Verify CHAPA_SECRET_KEY in environment.');
    } else if (error.response?.status === 404) {
      console.error('Not Found Error: Transaction reference not found in Chapa system. Verify the reference is correct.');
    } else if (error.response?.status === 429) {
      console.error('Rate Limit Error: Too many requests to Chapa API. Implement rate limiting or retry with backoff.');
    } else if (error.response?.status >= 500) {
      console.error('Server Error: Chapa API server error. This is typically temporary - retry may succeed.');
    }
    
    console.error('=== END CHAPA API ERROR ===');

    // Helper to format Chapa error message
    let errorMessage = error.message;
    if (error.response?.data?.message) {
      if (typeof error.response.data.message === 'object') {
        errorMessage = JSON.stringify(error.response.data.message);
      } else {
        errorMessage = error.response.data.message;
      }
    }

    console.error('Chapa payment verification error:', error.response?.data || error.message);
    throw new Error(`Payment verification failed: ${errorMessage}`);
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
