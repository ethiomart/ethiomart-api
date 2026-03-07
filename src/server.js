const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initializeDatabase } = require('./config/database');
const { sequelize } = require('./models');
const config = require('./config');
const { validatePaymentConfig } = require('./config/payment');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const categoryTemplateRoutes = require('./routes/categoryTemplateRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const chapaRoutes = require('./routes/chapaRoutes');
const adminRoutes = require('./routes/adminRoutes');
const addressRoutes = require('./routes/addressRoutes');
const cmsRoutes = require('./routes/cmsRoutes');

const app = express();

// Trust proxy - important for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

// Rate limiting middleware
// Adjust limits based on environment (more lenient for testing)
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.TESTING === 'true';
const unauthMaxRequests = isTestEnv ? 500 : 100;
const authMaxRequests = isTestEnv ? 5000 : 1000;

// Unauthenticated endpoints
const unauthenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: unauthMaxRequests,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      statusCode: 429
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for authenticated requests
    return req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
  }
});

// Authenticated endpoints
const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: authMaxRequests,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to authenticated requests
    return !(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));
  }
});

// Apply rate limiting
app.use(unauthenticatedLimiter);
app.use(authenticatedLimiter);

// Health check endpoints (both /health and /api/health)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Multi-Vendor E-Commerce API',
    version: '1.0.0',
    status: 'running'
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/user/addresses', addressRoutes); // Must come before /api/users to avoid route conflict
app.use('/api/users', userRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/categories', categoryTemplateRoutes); // Must come before categoryRoutes to match /templates routes
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chapa', chapaRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/monitoring', require('./routes/monitoringRoutes'));

// 404 handler - must come after all routes
app.use(notFoundHandler);

// Error handler - must be last
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Initialize database connection
    console.log('Initializing database connection...');
    await initializeDatabase();
    
    // Validate payment configuration
    console.log('Validating payment configuration...');
    validatePaymentConfig();
    
    // Validate Chapa callback and return URLs
    console.log('Validating Chapa URLs...');
    const callbackUrl = process.env.CHAPA_CALLBACK_URL;
    const returnUrl = process.env.CHAPA_RETURN_URL;
    
    // Check if CHAPA_CALLBACK_URL is configured
    if (!callbackUrl || callbackUrl.trim() === '') {
      throw new Error(
        'CHAPA_CALLBACK_URL is not configured. ' +
        'Please set it in your .env file. ' +
        'Example: CHAPA_CALLBACK_URL=https://yourdomain.com/api/payments/callback'
      );
    }
    
    // Check if CHAPA_RETURN_URL is configured
    if (!returnUrl || returnUrl.trim() === '') {
      throw new Error(
        'CHAPA_RETURN_URL is not configured. ' +
        'Please set it in your .env file. ' +
        'Example: CHAPA_RETURN_URL=https://yourdomain.com/api/payments/return'
      );
    }
    
    // Validate CHAPA_CALLBACK_URL format
    try {
      const callbackUrlObj = new URL(callbackUrl);
      
      // Check protocol
      if (!['http:', 'https:'].includes(callbackUrlObj.protocol)) {
        throw new Error(
          `CHAPA_CALLBACK_URL has invalid protocol '${callbackUrlObj.protocol}'. ` +
          'URL must start with http:// or https://. ' +
          `Current value: '${callbackUrl}'. ` +
          'Example: https://yourdomain.com/api/payments/callback'
        );
      }
      
      // Check HTTPS in production
      if (config.nodeEnv === 'production' && callbackUrlObj.protocol !== 'https:') {
        throw new Error(
          'CHAPA_CALLBACK_URL must use HTTPS in production environment. ' +
          `Current URL: ${callbackUrl}. ` +
          'Please update your .env file to use HTTPS. ' +
          'Example: CHAPA_CALLBACK_URL=https://yourdomain.com/api/payments/callback'
        );
      }
      
      // Check hostname is not empty and is a valid domain
      if (!callbackUrlObj.hostname || callbackUrlObj.hostname === '') {
        throw new Error(
          'CHAPA_CALLBACK_URL has no hostname. ' +
          `Current value: '${callbackUrl}'. ` +
          'URL must include a valid domain name. ' +
          'Example: https://yourdomain.com/api/payments/callback'
        );
      }
      
      // Check hostname contains a dot (basic domain validation)
      if (!callbackUrlObj.hostname.includes('.') && callbackUrlObj.hostname !== 'localhost') {
        throw new Error(
          'CHAPA_CALLBACK_URL has invalid hostname. ' +
          `Current hostname: '${callbackUrlObj.hostname}'. ` +
          'Hostname must be a valid domain name (e.g., yourdomain.com) or localhost. ' +
          'Example: https://yourdomain.com/api/payments/callback'
        );
      }
      
      console.log(`✓ CHAPA_CALLBACK_URL: ${callbackUrl}`);
    } catch (error) {
      if (error.message.startsWith('CHAPA_CALLBACK_URL')) {
        throw error; // Re-throw our custom errors
      }
      throw new Error(
        `CHAPA_CALLBACK_URL is malformed: ${error.message}. ` +
        `Current value: '${callbackUrl}'. ` +
        'Please provide a valid absolute URL with a proper domain name. ' +
        'Example: https://yourdomain.com/api/payments/callback'
      );
    }
    
    // Validate CHAPA_RETURN_URL format
    try {
      const returnUrlObj = new URL(returnUrl);
      
      // Check protocol
      if (!['http:', 'https:'].includes(returnUrlObj.protocol)) {
        throw new Error(
          `CHAPA_RETURN_URL has invalid protocol '${returnUrlObj.protocol}'. ` +
          'URL must start with http:// or https://. ' +
          `Current value: '${returnUrl}'. ` +
          'Example: https://yourdomain.com/api/payments/return'
        );
      }
      
      // Check HTTPS in production
      if (config.nodeEnv === 'production' && returnUrlObj.protocol !== 'https:') {
        throw new Error(
          'CHAPA_RETURN_URL must use HTTPS in production environment. ' +
          `Current URL: ${returnUrl}. ` +
          'Please update your .env file to use HTTPS. ' +
          'Example: CHAPA_RETURN_URL=https://yourdomain.com/api/payments/return'
        );
      }
      
      // Check hostname is not empty and is a valid domain
      if (!returnUrlObj.hostname || returnUrlObj.hostname === '') {
        throw new Error(
          'CHAPA_RETURN_URL has no hostname. ' +
          `Current value: '${returnUrl}'. ` +
          'URL must include a valid domain name. ' +
          'Example: https://yourdomain.com/api/payments/return'
        );
      }
      
      // Check hostname contains a dot (basic domain validation)
      if (!returnUrlObj.hostname.includes('.') && returnUrlObj.hostname !== 'localhost') {
        throw new Error(
          'CHAPA_RETURN_URL has invalid hostname. ' +
          `Current hostname: '${returnUrlObj.hostname}'. ` +
          'Hostname must be a valid domain name (e.g., yourdomain.com) or localhost. ' +
          'Example: https://yourdomain.com/api/payments/return'
        );
      }
      
      console.log(`✓ CHAPA_RETURN_URL: ${returnUrl}`);
    } catch (error) {
      if (error.message.startsWith('CHAPA_RETURN_URL')) {
        throw error; // Re-throw our custom errors
      }
      throw new Error(
        `CHAPA_RETURN_URL is malformed: ${error.message}. ` +
        `Current value: '${returnUrl}'. ` +
        'Please provide a valid absolute URL with a proper domain name. ' +
        'Example: https://yourdomain.com/api/payments/return'
      );
    }
    
    // Sync database models
    console.log('Synchronizing database models...');
    const syncOptions = { alter: false }; // Don't modify schema to avoid datetime issues
    await sequelize.sync(syncOptions);
    console.log('✓ Database models synchronized');
    
    // Start listening
    const PORT = config.port;
    const HOST = '0.0.0.0'; // Listen on all network interfaces
    app.listen(PORT, HOST, () => {
      console.log(`✓ Server is running on port ${PORT}`);
      console.log(`✓ Environment: ${config.nodeEnv}`);
      console.log(`✓ API URL: http://localhost:${PORT}`);
      console.log(`✓ Local Network: http://192.168.100.105:${PORT}`);
      console.log(`✓ Rate Limiting: Unauthenticated (${unauthMaxRequests}/15min), Authenticated (${authMaxRequests}/15min)`);
      console.log('\n=== Chapa Payment Configuration ===');
      console.log(`Callback URL: ${callbackUrl}`);
      console.log(`Return URL: ${returnUrl}`);
      console.log('===================================\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;
