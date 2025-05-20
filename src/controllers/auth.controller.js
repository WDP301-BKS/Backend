const { 
  apiResponse, 
  constants,
  errorHandler
} = require('../common');
const { authService } = require('../services');

const { asyncHandler } = errorHandler;
const { 
  authSuccessResponse, 
  errorResponse, 
  successResponse 
} = apiResponse;
const { SUCCESS_MESSAGES, HTTP_STATUS } = constants;

// Register a new user
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  try {
    const result = await authService.register({ name, email, password, phone, role });

    // Add verification status to response
    const message = result.emailSent 
      ? SUCCESS_MESSAGES.USER_REGISTERED
      : 'User registered successfully, but verification email could not be sent. Please contact support.';

    return authSuccessResponse(
      res,
      message,
      result.user,
      result.token,
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Login user
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await authService.login({ email, password });

    return authSuccessResponse(
      res,
      SUCCESS_MESSAGES.LOGIN_SUCCESS,
      result.user,
      result.token,
      HTTP_STATUS.OK
    );
  } catch (error) {
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.UNAUTHORIZED,
      error.errors
    );
  }
});

// Verify email with token
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  try {
    const result = await authService.verifyEmail(token);
    
    return successResponse(
      res, 
      result.message, 
      result.user, 
      HTTP_STATUS.OK
    );
  } catch (error) {
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Resend verification email
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  try {
    const result = await authService.resendVerificationEmail(email);
    
    return successResponse(
      res, 
      result.message, 
      null, 
      HTTP_STATUS.OK
    );
  } catch (error) {
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Google login or registration
const googleAuth = asyncHandler(async (req, res) => {
  const { tokenId, profileObj } = req.body;
  
  // Extra validation
  if (!tokenId || !profileObj) {
    return errorResponse(res, 'Missing required Google auth data', HTTP_STATUS.BAD_REQUEST);
  }
  
  try {
    const result = await authService.googleAuth({ tokenId, profileObj });

    return authSuccessResponse(
      res,
      'Google authentication successful',
      result.user,
      result.token,
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error('Google auth controller error:', error);
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

module.exports = {
  register,
  login,
  googleAuth,
  verifyEmail,
  resendVerification
}; 