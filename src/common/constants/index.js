/**
 * Hằng số cho vai trò người dùng
 */
const USER_ROLES = {
  CUSTOMER: 'customer',
  OWNER: 'owner',
  ADMIN: 'admin',
};

/**
 * Hằng số cho mã trạng thái HTTP
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

/**
 * Hằng số cho các thông báo lỗi
 */
const ERROR_MESSAGES = {
  // Auth errors
  INVALID_CREDENTIALS: 'Invalid email or password',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  EMAIL_ALREADY_EXISTS: 'Email already in use',
  USER_NOT_FOUND: 'User not found',
  ACCOUNT_INACTIVE: 'Account is inactive',
  INVALID_TOKEN: 'Invalid token',
  TOKEN_EXPIRED: 'Token has expired',
  
  // Validation errors
  VALIDATION_ERROR: 'Validation failed',
  
  // Server errors
  SERVER_ERROR: 'Internal server error',
  DB_ERROR: 'Database error',
};

/**
 * Hằng số cho các thông báo thành công
 */
const SUCCESS_MESSAGES = {
  USER_REGISTERED: 'User registered successfully',
  USER_UPDATED: 'User updated successfully',
  USER_DELETED: 'User deleted successfully',
  LOGIN_SUCCESS: 'Login successful',
};

/**
 * Hằng số cho cấu hình
 */
const CONFIG = {
  JWT_EXPIRATION: '1d',
  PASSWORD_SALT_ROUNDS: 10,
};

module.exports = {
  USER_ROLES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  CONFIG,
}; 