const cloudinary = require('cloudinary').v2;
const config = require('../config/cloudinaryConfig');
const logger = require('./logger');

/**
 * Generates a signed URL for private images on Cloudinary
 * 
 * @param {string} publicId - The public ID of the Cloudinary resource
 * @param {number} expiresIn - Time in seconds until URL expires (default: 300 seconds/5 minutes)
 * @param {string} originalUrl - Original URL from database (used as fallback)
 * @returns {string} - A signed URL with expiration timestamp
 */
const generateSignedUrl = (publicId, expiresIn = 300, originalUrl = null) => {
  try {
    if (!publicId) {
      logger.warn('Attempted to generate signed URL with null publicId');
      return originalUrl; // Return original URL as fallback
    }

    const timestamp = Math.round(new Date().getTime() / 1000) + expiresIn;
    
    // Make sure we have the correct resource type - default to image
    let resourceType = 'image';
    
    // Check the file extension to determine resource type
    if (publicId.endsWith('.pdf')) {
      resourceType = 'raw';
    } else if (publicId.match(/\.(mp4|mov|avi|wmv)$/i)) {
      resourceType = 'video';
    }
    
    // For URLs with these paths, always mark as private
    const isPrivateDocument = publicId.includes('secure_documents/') || 
                              publicId.includes('business_licenses/') || 
                              publicId.includes('identity_cards/');
    
    // Simplified options for Cloudinary URL generation to ensure maximum compatibility
    const signedUrl = cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      expires_at: timestamp,
      type: 'private',
      resource_type: resourceType,
      // Remove potentially problematic transformations
      // format: 'auto',
      // quality: 'auto',
      // fetch_format: 'auto'
    });

    logger.debug(`Generated signed URL for ${publicId}: ${signedUrl ? 'success' : 'failed'}`);
    
    // If signed URL generation fails, use the original URL as fallback
    if (!signedUrl && originalUrl) {
      logger.debug('Falling back to original URL');
      return originalUrl;
    }

    return signedUrl;
  } catch (error) {
    console.error(`Error generating signed URL:`, error);
    return null;
  }
};

/**
 * Extract Cloudinary public ID from a full URL
 * 
 * @param {string} cloudinaryUrl - Full Cloudinary URL
 * @returns {string|null} - Public ID or null if extraction failed
 */
const extractPublicIdFromUrl = (cloudinaryUrl) => {
  try {
    if (!cloudinaryUrl) {
      return null;
    }
    
    // For Cloudinary URLs with v1/v2 version identifiers
    if (cloudinaryUrl.match(/\/v\d+\//)) {
      // Pattern: domain.com/cloudname/type/version/folder/filename.ext
      const versionMatch = cloudinaryUrl.match(/\/v\d+\/(.+?)(\.[^.]+)?$/);
      if (versionMatch && versionMatch[1]) {
        const publicId = versionMatch[1];
        return publicId;
      }
    }
    
    // Check if URL contains cloudinary domain
    if (!cloudinaryUrl.includes('cloudinary.com')) {
      // Check if it might be a relative path within Cloudinary storage
      if (cloudinaryUrl.includes('secure_documents/') || 
          cloudinaryUrl.includes('business_licenses/') || 
          cloudinaryUrl.includes('identity_cards/')) {
        
        // If URL has file extension, remove it to get the public ID
        let publicId = cloudinaryUrl;
        if (publicId.includes('.')) {
          publicId = publicId.substring(0, publicId.lastIndexOf('.'));
        }
        
        return publicId;
      }
      
      // Still try to extract something useful as fallback
      const parts = cloudinaryUrl.split('/');
      return parts[parts.length - 1].split('.')[0];
    }
    
    // Handle different Cloudinary URL formats
    
    // Format 1: URLs with /upload/ in the path
    if (cloudinaryUrl.includes('/upload/')) {
      const uploadParts = cloudinaryUrl.split('/upload/');
      if (uploadParts.length < 2) {      return null;
      }
      
      // Get the path after /upload/
      const pathAfterUpload = uploadParts[1];
      
      // Remove transformation parameters if present
      let cleanPath = pathAfterUpload;
      if (pathAfterUpload.includes('/')) {
        cleanPath = pathAfterUpload.substring(pathAfterUpload.lastIndexOf('/') + 1);
      }
      
      // Remove file extension
      const publicId = cleanPath.split('.')[0];
      return publicId;
    }
    
    // Format 2: URLs with /private/ in the path (for secure documents)
    if (cloudinaryUrl.includes('/private/')) {
      const privateParts = cloudinaryUrl.split('/private/');
      if (privateParts.length < 2) {      return null;
      }
      
      // Get the path after /private/
      const pathAfterPrivate = privateParts[1];
      
      // Extract folder structure and filename without extension
      const parts = pathAfterPrivate.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      
      // Construct publicId including folder structure
      let publicId;
      if (parts.length > 1) {
        // Join all parts except the last one, then add the filename without extension
        const folders = parts.slice(0, -1).join('/');
        publicId = `${folders}/${filename}`;
      } else {
        publicId = filename;
      }
      
      return publicId;
    }
    
    // Format 3: URLs with res.cloudinary.com format
    if (cloudinaryUrl.includes('res.cloudinary.com')) {
      // Extract cloud name, type, and path
      const urlObj = new URL(cloudinaryUrl);
      const pathParts = urlObj.pathname.split('/');
      
      // Format is usually /{cloud_name}/{type}/{version}/{public_id}
      if (pathParts.length >= 4) {
        const cloudName = pathParts[1];
        const resourceType = pathParts[2]; // 'image', 'video', etc.
        
        // Skip version number which is typically pathParts[3]
        // Join remaining parts for the public ID, excluding the extension
        const remainingParts = pathParts.slice(4);
        const fullPath = remainingParts.join('/');
        const publicId = fullPath.split('.')[0];
        
        return publicId;
      }
    }
    
    // Fallback: Just try to extract the filename without extension from the last path segment
    const urlParts = cloudinaryUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const publicId = lastPart.split('.')[0];
    
    return publicId;
  } catch (error) {
    console.error(`Error extracting public ID:`, error);
    return null;
  }
};

/**
 * Generate a direct delivery URL for a private resource (alternative approach)
 * 
 * @param {string} publicId - The public ID of the resource
 * @param {number} expiresIn - Seconds until expiration
 * @returns {string} - Direct delivery URL
 */
const generateDirectDeliveryUrl = (publicId, expiresIn = 300) => {
  try {
    if (!publicId) {
      return null;
    }
    
    const timestamp = Math.round(new Date().getTime() / 1000) + expiresIn;
    
    // Get Cloudinary config
    const { cloud_name, api_key, api_secret } = cloudinary.config();
    
    // Determine resource type
    let resourceType = 'image';
    if (publicId.endsWith('.pdf')) {
      resourceType = 'raw';
    } else if (publicId.match(/\.(mp4|mov|avi|wmv)$/i)) {
      resourceType = 'video';
    }
    
    // Generate the signature for private resources
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${api_secret}`;
    const crypto = require('crypto');
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');
    
    // Construct URL with authentication parameters
    const params = `api_key=${api_key}&public_id=${encodeURIComponent(publicId)}&timestamp=${timestamp}&signature=${signature}`;
    const url = `https://res.cloudinary.com/${cloud_name}/${resourceType}/private/${publicId}?${params}`;
    
    return url;
  } catch (error) {
    console.error(`Error generating direct delivery URL:`, error);
    return null;
  }
};

/**
 * Check if a URL is a Cloudinary URL
 * 
 * @param {string} url - URL to check
 * @returns {boolean} - True if it's a Cloudinary URL
 */
const isCloudinaryUrl = (url) => {
  return url && typeof url === 'string' && 
    (url.includes('cloudinary.com') || url.startsWith('data:image'));
};

module.exports = {
  generateSignedUrl,
  generateDirectDeliveryUrl,
  extractPublicIdFromUrl,
  isCloudinaryUrl
};
