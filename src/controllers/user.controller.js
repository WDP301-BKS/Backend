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
    role: user.role,
    created_at: user.created_at
  }, HTTP_STATUS.OK);
});

// Update current user profile
const updateCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, email, password, phone } = req.body;
  
  const updatedUser = await userService.updateCurrentUser(userId, { name, email, password, phone });
  
  return successResponse(res, SUCCESS_MESSAGES.USER_UPDATED, {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    phone: updatedUser.phone,
    role: updatedUser.role
  }, HTTP_STATUS.OK);
});

// Get all users (admin only)
const getAllUsers = asyncHandler(async (req, res) => {
  const { role } = req.query;
  
  // Pagination parameters
  const pagination = getPaginationParams(req.query);
  
  // Sorting parameters
  const sorting = getSortingParams(req.query, 'created_at');
  
  const result = await userService.getAllUsers({ role }, pagination, sorting);
  
  return successResponse(res, 'Users fetched successfully', result, HTTP_STATUS.OK);
});

// Get user by ID (admin only)
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await userService.getUserById(id);
  
  return successResponse(res, 'User fetched successfully', user, HTTP_STATUS.OK);
});

// Update user by ID (admin only)
const updateUserById = asyncHandler(async (req, res) => {
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
});

// Delete user (admin only)
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await userService.deleteUser(id);
  
  return successResponse(res, SUCCESS_MESSAGES.USER_DELETED, null, HTTP_STATUS.OK);
});

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUser
}; 