const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Maximum file size: 5MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // Increased for high-res source files, we will compress them

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure uploads directory exists
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
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

/**
 * Optimized image processing using sharp
 */
const processImage = async (filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const tempPath = `${filePath}.tmp`;
    
    let pipeline = sharp(filePath)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true
      });

    // Convert to webp if it's not already or if we want to standardize
    // For compatibility with all clients, we'll keep JPEG but compress it heavily
    // or provide WebP if the client supports it. 
    // For now, let's keep original extension but optimize.
    
    if (ext === '.png') {
      await pipeline.png({ quality: 80, compressionLevel: 8 }).toFile(tempPath);
    } else {
      await pipeline.jpeg({ quality: 80, progressive: true }).toFile(tempPath);
    }

    // Replace original with optimized version
    fs.unlinkSync(filePath);
    fs.renameSync(tempPath, filePath);
    
    return true;
  } catch (error) {
    console.error(`Error processing image ${filePath}:`, error);
    return false;
  }
};

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
    
    singleUpload(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: {
                code: 'FILE_TOO_LARGE',
                message: 'File size exceeds 10MB limit'
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
      
      // Process and add file URL to request if file was uploaded
      if (req.file) {
        const filePath = req.file.path;
        await processImage(filePath);
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
    
    multipleUpload(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: {
                code: 'FILE_TOO_LARGE',
                message: 'One or more files exceed 10MB limit'
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
      
      // Process and add file URLs to request if files were uploaded
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await processImage(file.path);
        }
        req.fileUrls = req.files.map(file => `/uploads/${file.filename}`);
      }
      
      next();
    });
  };
};

/**
 * Middleware for variant image upload
 * Supports single image upload for variant combinations
 */
const uploadVariantImage = (req, res, next) => {
  const singleUpload = upload.single('image');
  
  singleUpload(req, res, async (err) => {
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
    
    // Process and add file URL to request if file was uploaded
    if (req.file) {
      await processImage(req.file.path);
      req.variantImageUrl = `/uploads/${req.file.filename}`;
    }
    
    next();
  });
};

/**
 * Get fallback image URL for variant
 * Returns variant image if available, otherwise product's primary image
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
