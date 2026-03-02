const { uploadToCloudinary } = require('../services/cloudinaryService');

/**
 * Middleware to upload files to Cloudinary after Multer has processed them.
 * This middleware expects req.file or req.files to be populated by Multer.
 * @param {string} folder - The base folder name in Cloudinary (e.g., 'users/avatars')
 */
const cloudinaryUpload = (folder) => {
  return async (req, res, next) => {
    try {
      // 1. Handle single file upload (e.g. uploadSingle)
      if (req.file) {
        const result = await uploadToCloudinary(req.file.path, folder);
        if (result.success) {
          // Overwrite req.fileUrl to use the Cloudinary secure URL
          req.fileUrl = result.secure_url;
          req.cloudinaryPublicId = result.public_id;
        } else {
          return res.status(500).json({
            success: false,
            message: `Cloudinary upload failed: ${result.error}`
          });
        }
      }

      // 2. Handle multiple file upload (e.g. uploadMultiple / upload.array)
      if (req.files && Array.isArray(req.files)) {
        const uploadPromises = req.files.map(file => uploadToCloudinary(file.path, folder));
        const results = await Promise.all(uploadPromises);
        
        const urls = [];
        const publicIds = [];
        
        for (const resObj of results) {
          if (!resObj.success) {
            return res.status(500).json({
              success: false,
              message: `Cloudinary upload failed: ${resObj.error}`
            });
          }
          urls.push(resObj.secure_url);
          publicIds.push(resObj.public_id);
        }
        
        // Overwrite req.fileUrls to use Cloudinary secure URLs
        req.fileUrls = urls;
        req.cloudinaryPublicIds = publicIds;
      }

      // 3. Handle multiple fields upload (e.g. upload.fields)
      if (req.files && !Array.isArray(req.files)) {
        for (const fieldName in req.files) {
          const fileArray = req.files[fieldName];
          if (fileArray && fileArray.length > 0) {
            const file = fileArray[0];
            const result = await uploadToCloudinary(file.path, folder);
            if (result.success) {
              // Attach the Cloudinary URL directly to the file object
              file.cloudinaryUrl = result.secure_url;
              file.cloudinaryPublicId = result.public_id;
            } else {
              return res.status(500).json({
                success: false,
                message: `Cloudinary upload failed for ${fieldName}: ${result.error}`
              });
            }
          }
        }
      }

      next();
    } catch (error) {
      console.error('❌ Cloudinary Middleware Error:', error);
      next(error);
    }
  };
};

module.exports = {
  cloudinaryUpload
};
