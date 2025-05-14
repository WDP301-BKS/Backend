const { 
  apiResponse, 
  constants,
  errorHandler
} = require('../common');
const { authService } = require('../services');

const { asyncHandler } = errorHandler;
const { authSuccessResponse, errorResponse } = apiResponse;
const { SUCCESS_MESSAGES, HTTP_STATUS } = constants;

// Register a new user
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  try {
    const result = await authService.register({ name, email, password, phone, role });

    return authSuccessResponse(
      res,
      SUCCESS_MESSAGES.USER_REGISTERED,
      result.user,
      result.token,
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || HTTP_STATUS.BAD_REQUEST);
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
    return errorResponse(res, error.message, error.statusCode || HTTP_STATUS.UNAUTHORIZED);
  }
});

// Google login or registration
const googleAuth = asyncHandler(async (req, res) => {
  const { tokenId, profileObj } = req.body;
  
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
    return errorResponse(res, error.message, error.statusCode || HTTP_STATUS.BAD_REQUEST);
  }
});

module.exports = {
  register,
  login,
  googleAuth
}; 