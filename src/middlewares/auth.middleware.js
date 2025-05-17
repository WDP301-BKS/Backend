const { User } = require('../models');
const { jwtUtils, apiResponse, errorHandler, constants } = require('../common');
const { verifyToken, extractTokenFromHeader } = jwtUtils;
const { unauthorizedResponse, forbiddenResponse } = apiResponse;
const { asyncHandler } = errorHandler;
const { USER_ROLES, ERROR_MESSAGES } = constants;

const authMiddleware = asyncHandler(async (req, res, next) => {
  // Lấy token từ header
  const token = extractTokenFromHeader(req);
  
  if (!token) {
    return unauthorizedResponse(res, ERROR_MESSAGES.INVALID_TOKEN);
  }

  try {
    // Xác thực token
    const decoded = verifyToken(token);
    
    // Tìm user trong database
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] } // Không trả về mật khẩu
    });
    
    if (!user) {
      return unauthorizedResponse(res, ERROR_MESSAGES.USER_NOT_FOUND);
    }
    
    if (!user.is_active) {
      return forbiddenResponse(res, ERROR_MESSAGES.ACCOUNT_INACTIVE);
    }
    
    // Gán user vào request để sử dụng ở các middleware tiếp theo
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      is_active: user.is_active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return unauthorizedResponse(res, error.message);
  }
});

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === USER_ROLES.ADMIN) {
    next();
  } else {
    return forbiddenResponse(res, ERROR_MESSAGES.FORBIDDEN);
  }
};

const isOwner = (req, res, next) => {
  if (req.user && (req.user.role === USER_ROLES.OWNER || req.user.role === USER_ROLES.ADMIN)) {
    next();
  } else {
    return forbiddenResponse(res, ERROR_MESSAGES.FORBIDDEN);
  }
};

const isCustomer = (req, res, next) => {
  if (req.user && req.user.role === USER_ROLES.CUSTOMER) {
    next();
  } else {
    return forbiddenResponse(res, ERROR_MESSAGES.FORBIDDEN);
  }
};

const isOwnerOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === USER_ROLES.OWNER || req.user.role === USER_ROLES.ADMIN)) {
    next();
  } else {
    return forbiddenResponse(res, ERROR_MESSAGES.FORBIDDEN);
  }
};

module.exports = {
  authMiddleware,
  isAdmin,
  isOwner,
  isCustomer,
  isOwnerOrAdmin
}; 