const cloudinary = require('../config/cloudinary');

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} - Public ID or null
 */
const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  // Example URL: https://res.cloudinary.com/dt6s0vrab/image/upload/v1634567890/products/abc123.jpg
  // The public ID is 'products/abc123' (excluding version, file extension and base URL)
  
  try {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;
    
    // Skip 'upload' and the 'version' (v1234567890) if present
    let publicIdParts = parts.slice(uploadIndex + 1);
    if (publicIdParts[0].startsWith('v') && !isNaN(publicIdParts[0].substring(1))) {
      publicIdParts = publicIdParts.slice(1);
    }
    
    const publicIdWithExtension = publicIdParts.join('/');
    const publicId = publicIdWithExtension.split('.')[0];
    return publicId;
  } catch (error) {
    console.error('Error extracting public ID from URL:', error);
    return null;
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} url - Cloudinary URL
 * @returns {Promise<boolean>}
 */
const deleteFromCloudinary = async (url) => {
  const publicId = getPublicIdFromUrl(url);
  if (!publicId) return false;
  
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`Cloudinary deletion result for ${publicId}:`, result);
    return result.result === 'ok';
  } catch (error) {
    console.error(`Error deleting image from Cloudinary (${publicId}):`, error);
    return false;
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {string[]} urls - Array of Cloudinary URLs
 * @returns {Promise<void>}
 */
const deleteMultipleFromCloudinary = async (urls) => {
  if (!urls || !Array.isArray(urls)) return;
  
  const deletePromises = urls.map(url => deleteFromCloudinary(url));
  await Promise.all(deletePromises);
};

module.exports = {
  getPublicIdFromUrl,
  deleteFromCloudinary,
  deleteMultipleFromCloudinary
};
