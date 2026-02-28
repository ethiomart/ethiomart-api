/**
 * Transform relative image URLs to absolute URLs
 * @param {Object} req - Express request object
 * @param {Array|string} images - Image URL(s) to transform
 * @returns {Array|string} Transformed image URL(s)
 */
const transformImageUrls = (req, images) => {
  if (!images) return images;
  
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  const transformUrl = (url) => {
    if (!url) return url;
    // Skip URLs that are already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Transform relative URLs starting with /uploads/
    if (url.startsWith('/uploads/')) {
      return `${baseUrl}${url}`;
    }
    // If it doesn't start with / but contains uploads, try prepending /
    if (url.includes('uploads/') && !url.startsWith('/')) {
      return `${baseUrl}/${url}`;
    }
    return url;
  };
  
  // Handle array of images
  if (Array.isArray(images)) {
    return images.map(transformUrl);
  }
  
  // Handle single image string
  return transformUrl(images);
};

module.exports = {
  transformImageUrls
};
