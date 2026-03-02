const cloudinary = require('../config/cloudinary');
const fs = require('fs');

/**
 * Upload a file to Cloudinary
 * @param {string} filePath - Path to the local file
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (filePath, folder) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `ecommerce/${folder}`,
      resource_type: 'auto', // Support images, PDFs, etc.
      // Automatic optimization and format selection
      quality: 'auto',
      fetch_format: 'auto'
    });
    
    // Remove local file after successful upload
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return {
      success: true,
      secure_url: result.secure_url,
      public_id: result.public_id
    };
  } catch (error) {
    console.error('❌ Cloudinary Upload Error:', error);
    // Cleanup local file even on error
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<object>} - Cloudinary deletion result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return { success: false, error: 'Public ID is required' };
    
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: true,
      result: result.result
    };
  } catch (error) {
    console.error('❌ Cloudinary Deletion Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Specialized uploaders
 */
const uploadUserAvatar = (filePath) => uploadToCloudinary(filePath, 'users/avatars');
const uploadSellerDoc = (filePath) => uploadToCloudinary(filePath, 'sellers/docs');
const uploadProductImage = (filePath) => uploadToCloudinary(filePath, 'products/images');
const uploadAdminBanner = (filePath) => uploadToCloudinary(filePath, 'admin/banners');

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadUserAvatar,
  uploadSellerDoc,
  uploadProductImage,
  uploadAdminBanner
};
