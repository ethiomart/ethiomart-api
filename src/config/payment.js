require('dotenv').config();

/**
 * Payment Configuration
 * Manages Chapa payment gateway settings with environment-based configuration
 */

const paymentConfig = {
  // Chapa API Configuration
  chapa: {
    secretKey: process.env.CHAPA_SECRET_KEY,
    publicKey: process.env.CHAPA_PUBLIC_KEY,
    encryptionKey: process.env.CHAPA_ENCRYPTION_KEY,
    apiUrl: process.env.CHAPA_API_URL || 'https://api.chapa.co/v1',
    webhookSecret: process.env.CHAPA_WEBHOOK_SECRET,
    testMode: process.env.CHAPA_TEST_MODE === 'true',
  },

  // Payment Flow URLs
  urls: {
    callbackUrl: process.env.PAYMENT_CALLBACK_URL || `http://localhost:${process.env.PORT || 5000}/api/payments/webhook`,
    returnUrl: process.env.PAYMENT_RETURN_URL || 'http://localhost:3000/payment/return',
  },

  // Payment Settings
  settings: {
    currency: process.env.PAYMENT_CURRENCY || 'ETB',
    timeout: parseInt(process.env.PAYMENT_TIMEOUT || '30000', 10),
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
  },

  // Environment
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.CHAPA_TEST_MODE === 'true',
};

/**
 * Validate payment configuration
 * Ensures all required environment variables are set
 * @throws {Error} If required configuration is missing
 */
function validatePaymentConfig() {
  const required = [
    { key: 'CHAPA_SECRET_KEY', value: paymentConfig.chapa.secretKey },
    { key: 'CHAPA_API_URL', value: paymentConfig.chapa.apiUrl },
    { key: 'PAYMENT_CALLBACK_URL', value: paymentConfig.urls.callbackUrl },
    { key: 'PAYMENT_RETURN_URL', value: paymentConfig.urls.returnUrl },
  ];

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    const missingKeys = missing.map(({ key }) => key).join(', ');
    throw new Error(
      `Missing required payment configuration: ${missingKeys}. ` +
      `Please check your .env file and ensure all Chapa payment variables are set.`
    );
  }

  // Warn about test mode in production
  if (paymentConfig.isProduction && paymentConfig.isTest) {
    console.warn(
      '⚠️  WARNING: Chapa is in TEST MODE but NODE_ENV is production. ' +
      'Set CHAPA_TEST_MODE=false for production payments.'
    );
  }

  // Validate webhook secret
  if (!paymentConfig.chapa.webhookSecret || paymentConfig.chapa.webhookSecret.includes('your_webhook_secret')) {
    console.warn(
      '⚠️  WARNING: CHAPA_WEBHOOK_SECRET is not properly configured. ' +
      'Webhook signature verification will fail. Generate a strong random secret.'
    );
  }

  console.log('✓ Payment configuration validated successfully');
  console.log(`  Environment: ${paymentConfig.environment}`);
  console.log(`  Test Mode: ${paymentConfig.isTest ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  Currency: ${paymentConfig.settings.currency}`);
}

/**
 * Get payment configuration for specific environment
 * @param {string} env - Environment name (development, production, test)
 * @returns {object} Environment-specific configuration
 */
function getConfigForEnvironment(env = process.env.NODE_ENV) {
  const baseConfig = { ...paymentConfig };

  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        chapa: {
          ...baseConfig.chapa,
          testMode: false,
        },
        settings: {
          ...baseConfig.settings,
          timeout: 45000, // Longer timeout for production
        },
      };

    case 'test':
      return {
        ...baseConfig,
        chapa: {
          ...baseConfig.chapa,
          testMode: true,
        },
        settings: {
          ...baseConfig.settings,
          timeout: 10000, // Shorter timeout for tests
          maxRetries: 1, // Fewer retries in tests
        },
      };

    case 'development':
    default:
      return baseConfig;
  }
}

module.exports = paymentConfig;
module.exports.validatePaymentConfig = validatePaymentConfig;
module.exports.getConfigForEnvironment = getConfigForEnvironment;
