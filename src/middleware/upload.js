const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename using timestamp and random string
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(file.originalname);
    const uniqueFilename = `${timestamp}-${randomString}${extension}`;
    cb(null, uniqueFilename);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only JPEG, PNG, and WebP images are allowed.`), false);
  }
};

// Create multer instance with configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Middleware for single file upload
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: {
                code: 'FILE_TOO_LARGE',
                message: 'File size exceeds 5MB limit'
              }
            });
          }
          return res.status(400).json({
            success: false,
            error: {
              code: 'UPLOAD_ERROR',
              message: err.message
            }
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE',
            message: err.message
          }
        });
      }
      
      // Add file URL to request if file was uploaded
      if (req.file) {
        req.fileUrl = `/uploads/${req.file.filename}`;
      }
      
      next();
    });
  };
};

// Middleware for multiple file uploads (max 5)
const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: {
                code: 'FILE_TOO_LARGE',
                message: 'One or more files exceed 5MB limit'
              }
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
              success: false,
              error: {
                code: 'TOO_MANY_FILES',
                message: `Maximum ${maxCount} files allowed`
              }
            });
          }
          return res.status(400).json({
            success: false,
            error: {
              code: 'UPLOAD_ERROR',
              message: err.message
            }
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE',
            message: err.message
          }
        });
      }
      
      // Add file URLs to request if files were uploaded
      if (req.files && req.files.length > 0) {
        req.fileUrls = req.files.map(file => `/uploads/${file.filename}`);
      }
      
      next();
    });
  };
};

/**
 * Middleware for variant image upload
 * Supports single image upload for variant combinations
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
const uploadVariantImage = (req, res, next) => {
  const singleUpload = upload.single('image');
  
  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'Image file size exceeds 5MB limit'
            }
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message
          }
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE',
          message: err.message
        }
      });
    }
    
    // Add file URL to request if file was uploaded
    if (req.file) {
      req.variantImageUrl = `/uploads/${req.file.filename}`;
    }
    
    next();
  });
};

/**
 * Get fallback image URL for variant
 * Returns variant image if available, otherwise product's primary image
 * Requirements: 9.5
 */
const getVariantImageUrl = (variantImageUrl, productImages) => {
  // Return variant image if available
  if (variantImageUrl) {
    return variantImageUrl;
  }
  
  // Fallback to product's primary image
  if (productImages && Array.isArray(productImages) && productImages.length > 0) {
    return productImages[0];
  }
  
  // No image available
  return null;
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadVariantImage,
  getVariantImageUrl,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE
};
