const crypto = require('crypto');
const securityLogger = require('../utils/securityLogger');

/**
 * Middleware to verify webhook signature from Chapa
 * 
 * Security Requirements:
 * - Validates that incoming webhook requests are genuinely from Chapa
 * - Uses HMAC SHA256 signature verification
 * - Employs timing-safe comparison to prevent timing attacks
 * - Logs all verification failures for security monitoring
 * - Returns generic error messages to prevent information leakage
 * 
 * Task 8.4: Add webhook signature verification middleware
 * Requirements: 2.1, 2.2, 3.7, 3.8, 3.9
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const verifyWebhookSignature = (req, res, next) => {
  try {
    // Extract signature from request headers
    // Chapa may send signature in different header formats
    const signature = req.headers['chapa-signature'] || 
                     req.headers['x-chapa-signature'] || 
                     req.headers['Chapa-Signature'] ||
                     req.headers['X-Chapa-Signature'];

    // Get webhook secret from environment variables
    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;

    // Log webhook attempt for security auditing
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Webhook signature verification attempt from IP: ${req.ip}`);

    // Check if webhook secret is configured
    if (!webhookSecret) {
      console.warn('CHAPA_WEBHOOK_SECRET not configured. Skipping signature verification in development mode.');
      
      // In production, this should be an error
      if (process.env.NODE_ENV === 'production') {
        securityLogger.logWebhookSecurityEvent({
          event: 'missing_webhook_secret',
          ip: req.ip,
          timestamp,
          severity: 'critical'
        });

        return res.status(503).json({
          success: false,
          message: 'Service configuration error'
        });
      }
      
      // Allow in development/test mode
      return next();
    }

    // Check if signature is present
    if (!signature) {
      console.error('Webhook received without signature header');
      
      // Log missing signature attempt
      securityLogger.logInvalidWebhookSignature({
        txRef: req.body?.tx_ref || 'unknown',
        ip: req.ip,
        signature: 'missing',
        timestamp
      });

      // Return 401 Unauthorized for missing signature
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Get raw request body for signature verification
    // Note: This requires express.json() middleware to preserve rawBody
    // or body-parser with verify option
    const payload = req.body;
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Compute expected signature using webhook secret and request body
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    // Compare signatures using timing-safe comparison to prevent timing attacks
    // This is critical for security - prevents attackers from using timing analysis
    // to guess the signature byte by byte
    let isValid = false;
    
    try {
      // Convert both signatures to buffers for timing-safe comparison
      const signatureBuffer = Buffer.from(signature, 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      
      // Check if lengths match first (timing-safe comparison requires equal length)
      if (signatureBuffer.length === expectedBuffer.length) {
        isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
      }
    } catch (comparisonError) {
      // If timing-safe comparison fails (e.g., different lengths), signature is invalid
      console.error('Signature comparison error:', comparisonError.message);
      isValid = false;
    }

    // Handle verification result
    if (!isValid) {
      console.error(`Invalid webhook signature from IP: ${req.ip}`);
      console.error(`Expected signature: ${expectedSignature.substring(0, 10)}...`);
      console.error(`Received signature: ${signature.substring(0, 10)}...`);
      
      // Log invalid signature attempt for security monitoring
      securityLogger.logInvalidWebhookSignature({
        txRef: req.body?.tx_ref || 'unknown',
        ip: req.ip,
        signature: 'invalid',
        timestamp,
        expectedPrefix: expectedSignature.substring(0, 10),
        receivedPrefix: signature.substring(0, 10)
      });

      // Return 401 Unauthorized with generic error message
      // Don't reveal details about why verification failed
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Signature is valid - log success and proceed
    console.log(`[${timestamp}] Webhook signature verified successfully for tx_ref: ${req.body?.tx_ref || 'unknown'}`);
    
    securityLogger.logWebhookSecurityEvent({
      event: 'signature_verified',
      txRef: req.body?.tx_ref || 'unknown',
      ip: req.ip,
      timestamp,
      severity: 'info'
    });

    // Proceed to next middleware/controller
    next();
    
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    
    // Log unexpected error
    securityLogger.logWebhookSecurityEvent({
      event: 'verification_error',
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'error'
    });

    // Return 500 Internal Server Error for unexpected errors
    // Still use generic message to prevent information leakage
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = verifyWebhookSignature;
