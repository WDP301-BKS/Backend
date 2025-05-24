const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Debug Cloudinary config
console.log('Cloudinary Config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET?.substring(0, 5) + '...' // Only show first 5 chars of secret
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000 // Add 60s timeout
});


const uploadImage = async (fileBuffer, options = {}) => {
  try {
    // Create a promise to handle the upload with timeout
    return new Promise((resolve, reject) => {
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

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage
}; 