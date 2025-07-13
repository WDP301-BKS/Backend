const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000 // Add 60s timeout
});


/**
 * Uploads an image to Cloudinary
 * 
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {Object} options - Upload options
 * @param {string} options.folder - Cloudinary folder path
 * @param {boolean} options.secure - Whether to use private_cdn for secure documents
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadImage = async (fileBuffer, options = {}) => {
  try {
    // Create a promise to handle the upload with timeout
    return new Promise((resolve, reject) => {
      // Determine if this is a secure document (ID cards, business licenses)
      const isSecureDocument = options.secure || 
        (options.folder && ['documents', 'identity_cards', 'business_licenses'].includes(options.folder));
      
      // Set default upload options for profile images
      const uploadOptions = {
        folder: options.folder || 'profiles',
        transformation: options.transformation || [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' }
        ],
        resource_type: 'auto', // Auto-detect resource type
        timeout: 60000, // 60s timeout
        ...options
      };
      
      // If this is a secure document, make it private
      if (isSecureDocument) {
        uploadOptions.type = 'private';
        uploadOptions.folder = options.folder || 'secure_documents';
        console.log('Uploading secure document with private access type');
      }

      // Use Cloudinary's uploader with a stream
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(new Error(`Failed to upload to Cloudinary: ${error.message}`));
          }
          resolve(result);
        }
      );

      // Convert buffer to stream and pipe to uploadStream with error handling
      const Readable = require('stream').Readable;
      const readableStream = new Readable();
      
      readableStream.on('error', (error) => {
        console.error('Stream error:', error);
        reject(new Error(`Stream error: ${error.message}`));
      });

      uploadStream.on('error', (error) => {
        console.error('Upload stream error:', error);
        reject(new Error(`Upload stream error: ${error.message}`));
      });

      readableStream.push(fileBuffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - The public ID of the image to delete
 * @returns {Promise<Object>} Cloudinary deletion result
 */
const deleteImage = async (publicId) => {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Generate a signed URL for a private asset
 * 
 * @param {string} publicId - The public ID of the resource
 * @param {number} expiresAt - Expiration time in seconds from now
 * @returns {string} - Signed URL with expiration
 */
const generateSignedUrl = (publicId, expiresAt = 300) => {
  if (!publicId) return null;
  
  try {
    // Calculate expiration timestamp (current time + expiration seconds)
    const timestamp = Math.round(new Date().getTime() / 1000) + expiresAt;
    
    return cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      expires_at: timestamp,
      type: 'private'
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
};

/**
 * Extract public ID from a Cloudinary URL
 * 
 * @param {string} url - Full Cloudinary URL
 * @returns {string|null} - The extracted public ID or null
 */
const extractPublicId = (url) => {
  if (!url) return null;
  
  try {
    // Check if it's a Cloudinary URL
    if (!url.includes('cloudinary.com')) {
      return null;
    }
    
    // Parse the URL to extract the public ID
    const urlParts = url.split('/');
    
    // Find the upload part (or private part)
    const uploadIndex = urlParts.findIndex(part => 
      part === 'upload' || part === 'private'
    );
    
    if (uploadIndex === -1) return null;
    
    // Get everything after upload/private and before file extension
    const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
    const publicId = pathAfterUpload.split('.')[0];
    
    return publicId;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  generateSignedUrl,
  extractPublicId
}; 