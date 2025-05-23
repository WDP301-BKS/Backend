const { 
  apiResponse, 
  errorHandler, 
  constants, 
  validationUtils
} = require('../common');
const { userService } = require('../services');

const { asyncHandler } = errorHandler;
const { 
  successResponse, 
  errorResponse, 
  notFoundResponse
} = apiResponse;
const { SUCCESS_MESSAGES, HTTP_STATUS } = constants;
const { getPaginationParams, getSortingParams } = validationUtils;

// Get current user profile
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;
  
  return successResponse(res, 'User profile fetched successfully', {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage,
    bio: user.bio,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    address: user.address,
    role: user.role,
    created_at: user.created_at
  }, HTTP_STATUS.OK);
});

// Update current user profile
const updateCurrentUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone, bio, gender, dateOfBirth, address } = req.body;
    
    const updatedUser = await userService.updateCurrentUser(userId, { 
      name, email, phone, bio, gender, dateOfBirth, address 
    });
    
    return successResponse(res, SUCCESS_MESSAGES.USER_UPDATED, {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      profileImage: updatedUser.profileImage,
      bio: updatedUser.bio,
      gender: updatedUser.gender,
      dateOfBirth: updatedUser.dateOfBirth,
      address: updatedUser.address,
      role: updatedUser.role
    }, HTTP_STATUS.OK);
  } catch (error) {
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Upload profile image
const uploadProfileImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'No file uploaded', HTTP_STATUS.BAD_REQUEST);
    }

    const result = await userService.uploadProfileImage(req.user.id, req.file.buffer);
    
    return successResponse(res, 'Profile image uploaded successfully', result, HTTP_STATUS.OK);
  } catch (error) {
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Delete profile image
const deleteProfileImage = asyncHandler(async (req, res) => {
  try {
    const result = await userService.deleteProfileImage(req.user.id);
    
    return successResponse(res, 'Profile image deleted successfully', result, HTTP_STATUS.OK);
  } catch (error) {
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // First verify the current password
    const user = await userService.findById(userId);
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return errorResponse(res, 'Current password is incorrect', HTTP_STATUS.UNAUTHORIZED);
    }
    
    // Update with new password
    await userService.updateCurrentUser(userId, { password: newPassword });
    
    return successResponse(res, 'Password changed successfully', null, HTTP_STATUS.OK);
  } catch (error) {
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Request password reset
const requestPasswordReset = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    
    const result = await userService.requestPasswordReset(email);
    
    return successResponse(res, 'Password reset email sent', null, HTTP_STATUS.OK);
  } catch (error) {
    // Always return success even if email not found for security reasons
    if (error.statusCode === HTTP_STATUS.NOT_FOUND) {
      return successResponse(res, 'If the email exists, a password reset link will be sent', null, HTTP_STATUS.OK);
    }
    
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Reset password with token
const resetPassword = asyncHandler(async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    const result = await userService.resetPassword(token, newPassword);
    
    return successResponse(res, 'Password has been reset successfully', null, HTTP_STATUS.OK);
  } catch (error) {
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Get all users (admin only)
const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const { role } = req.query;
    
    // Pagination parameters
    const pagination = getPaginationParams(req.query);
    
    // Sorting parameters
    const sorting = getSortingParams(req.query, 'created_at');
    
    const result = await userService.getAllUsers({ role }, pagination, sorting);
    
    return successResponse(res, 'Users fetched successfully', result, HTTP_STATUS.OK);
  } catch (error) {
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Get user by ID (admin only)
const getUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await userService.getUserById(id);
    
    return successResponse(res, 'User fetched successfully', user, HTTP_STATUS.OK);
  } catch (error) {
    if (error.statusCode === HTTP_STATUS.NOT_FOUND) {
      return notFoundResponse(res, error.message);
    }
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Update user by ID (admin only)
const updateUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, phone, role, is_active } = req.body;
    
    const updatedUser = await userService.updateUserById(id, { 
      name, email, password, phone, role, is_active 
    });
    
    return successResponse(res, SUCCESS_MESSAGES.USER_UPDATED, {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      is_active: updatedUser.is_active
    }, HTTP_STATUS.OK);
  } catch (error) {
    if (error.statusCode === HTTP_STATUS.NOT_FOUND) {
      return notFoundResponse(res, error.message);
    }
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

// Delete user (admin only)
const deleteUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    await userService.deleteUser(id);
    
    return successResponse(res, SUCCESS_MESSAGES.USER_DELETED, null, HTTP_STATUS.OK);
  } catch (error) {
    if (error.statusCode === HTTP_STATUS.NOT_FOUND) {
      return notFoundResponse(res, error.message);
    }
    return errorResponse(
      res, 
      error.message, 
      error.statusCode || HTTP_STATUS.BAD_REQUEST,
      error.errors
    );
  }
});

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  uploadProfileImage,
  deleteProfileImage,
  changePassword,
  requestPasswordReset,
  resetPassword,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUser
}; 