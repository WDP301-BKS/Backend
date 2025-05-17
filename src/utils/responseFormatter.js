/**
 * Response Formatter Utility
 * Provides standardized API response formats
 */
const logger = require('./logger');

/**
 * Format a successful response
 * @param {*} data - Data to be returned
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Formatted success response
 */
exports.success = (data, message = 'Success', statusCode = 200) => {
  logger.debug('Response formatter: Success', { message, statusCode });
  return {
    success: true,
    message,
    statusCode,
    data
  };
};

/**
 * Format an error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {*} errors - Additional error details
 * @returns {Object} Formatted error response
 */
exports.error = (message = 'An error occurred', statusCode = 500, errors = null) => {
  logger.debug('Response formatter: Error', { message, statusCode });
  return {
    success: false,
    message,
    statusCode,
    errors
  };
};

/**
 * Format a validation error response
 * @param {Array|Object} errors - Validation errors
 * @param {string} message - Error message
 * @returns {Object} Formatted validation error response
 */
exports.validationError = (errors, message = 'Validation failed') => {
  logger.debug('Response formatter: Validation error', { message });
  return exports.error(message, 422, errors);
};

/**
 * Format an unauthorized error response
 * @param {string} message - Error message
 * @returns {Object} Formatted unauthorized error response
 */
exports.unauthorized = (message = 'Unauthorized access') => {
  logger.debug('Response formatter: Unauthorized', { message });
  return exports.error(message, 401);
};

/**
 * Format a forbidden error response
 * @param {string} message - Error message
 * @returns {Object} Formatted forbidden error response
 */
exports.forbidden = (message = 'Access forbidden') => {
  logger.debug('Response formatter: Forbidden', { message });
  return exports.error(message, 403);
};

/**
 * Format a not found error response
 * @param {string} message - Error message
 * @returns {Object} Formatted not found error response
 */
exports.notFound = (message = 'Resource not found') => {
  logger.debug('Response formatter: Not found', { message });
  return exports.error(message, 404);
}; 