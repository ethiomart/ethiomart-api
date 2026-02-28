const User = require('../models/User');
const Seller = require('../models/Seller');
const { verifyRefreshToken } = require('../utils/tokenUtils');
const { transformImageUrls } = require('../utils/imageUtils');

// Store for invalidated refresh tokens (in production, use Redis or database)
const invalidatedTokens = new Set();

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, phoneNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if phone number already exists (if provided)
    if (phoneNumber) {
      const existingPhone = await User.findOne({ where: { phone: phoneNumber } });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }
    }

    // Create new user (password will be hashed by beforeCreate hook)
    const user = await User.create({
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      phone: phoneNumber || null, // Map phoneNumber to phone
      role: role || 'customer'
    });

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Return user data without password
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone, // Map phone back to phoneNumber
      role: user.role,
      profilePictureUrl: user.profile_picture_url,
      isActive: user.is_active
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userData,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    // Handle phone validation errors
    if (error.name === 'SequelizeValidationError') {
      const phoneError = error.errors.find(err => err.path === 'phone');
      if (phoneError) {
        return res.status(400).json({
          success: false,
          message: phoneError.message || 'Invalid phone number format'
        });
      }
    }
    
    // Handle unique constraint violation for phone
    if (error.name === 'SequelizeUniqueConstraintError') {
      const phoneError = error.errors.find(err => err.path === 'phone');
      if (phoneError) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }
    }
    
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Return user data without password
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone, // Map phone back to phoneNumber
      role: user.role,
      profilePictureUrl: user.profile_picture_url,
      isActive: user.is_active
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * @route POST /api/auth/refresh
 * @access Public
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Check if token has been invalidated
    if (invalidatedTokens.has(token)) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been invalidated'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Generate new access token
    const newAccessToken = user.generateAccessToken();

    res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 * @access Private
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Add token to invalidated set
    invalidatedTokens.add(token);

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/profile
 * @access Private
 */
const getProfile = async (req, res, next) => {
  try {
    // User is attached to req by verifyToken middleware
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phoneNumber: user.phone, // Map phone back to phoneNumber
          role: user.role,
          profilePictureUrl: transformImageUrls(req, user.profile_picture_url),
          isActive: user.is_active,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register seller account
 * @route POST /api/auth/register-seller
 * @access Private
 */
const registerSeller = async (req, res, next) => {
  try {
    const { 
      businessName,
      storeName,
      businessDescription,
      description,
      businessAddress, 
      businessPhone, 
      businessEmail,
      taxId,
      accountNumber,
      bankName,
      accountHolder
    } = req.body;

    const finalStoreName = businessName || storeName;
    const finalDescription = businessDescription || description;
    const finalBusinessEmail = businessEmail || req.user.email;
    
    // User is attached to req by verifyToken middleware
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required'
      });
    }
    
    // Check if user already has seller account
    const existingSeller = await Seller.findOne({ 
      where: { user_id: req.user.id } 
    });
    
    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'Seller account already exists'
      });
    }

    // Generate store slug from business name
    const storeSlug = finalStoreName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if store name/slug is already taken
    const slugConflict = await Seller.findOne({ where: { store_slug: storeSlug } });
    if (slugConflict) {
      return res.status(400).json({
        success: false,
        message: 'A store with this name already exists. Please choose a different name.'
      });
    }
    
    // Handle file uploads
    let businessLicenseUrl = null;
    let verificationDocUrl = null;
    
    if (req.files) {
      if (req.files.businessLicense) {
        businessLicenseUrl = `/uploads/${req.files.businessLicense[0].filename}`;
      }
      if (req.files.verificationDoc) {
        verificationDocUrl = `/uploads/${req.files.verificationDoc[0].filename}`;
      }
    }
    
    // Create seller account with all fields
    const seller = await Seller.create({
      user_id: req.user.id,
      store_name: finalStoreName,
      store_slug: storeSlug,
      store_description: finalDescription,
      business_address: businessAddress,
      business_phone: businessPhone,
      business_email: finalBusinessEmail,
      tax_id: taxId || null,
      business_license_url: businessLicenseUrl,
      verification_doc_url: verificationDocUrl,
      bank_account_number: accountNumber,
      bank_name: bankName,
      bank_account_name: accountHolder,
      approval_status: 'pending'
    });
    
    res.status(201).json({
      success: true,
      message: 'Seller registration submitted successfully. Your application will be reviewed by our team.',
      data: { 
        seller: {
          id: seller.id,
          storeName: seller.store_name,
          storeSlug: seller.store_slug,
          description: seller.store_description,
          businessAddress: seller.business_address,
          businessPhone: seller.business_phone,
          taxId: seller.tax_id,
          businessLicenseUrl: seller.business_license_url,
          verificationDocUrl: seller.verification_doc_url,
          accountNumber: seller.bank_account_number,
          bankName: seller.bank_name,
          accountHolder: seller.bank_account_name,
          approvalStatus: seller.approval_status,
          createdAt: seller.created_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save FCM push token
 * @route POST /api/auth/fcm-token
 * @access Private
 */
const saveFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.fcm_token = token;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'FCM token saved successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  registerSeller,
  saveFcmToken
};
