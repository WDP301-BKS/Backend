const { userRepository } = require('../repositories');
const { errorHandler, constants } = require('../common');
const { ERROR_MESSAGES } = constants;

class UserService {
  // Get current user profile
  async getCurrentUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    return user;
  }
  
  // Update current user profile
  async updateCurrentUser(userId, updateData) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    
    // Check if email is already in use by another user
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await userRepository.findByEmail(updateData.email);
      if (existingUser) {
        throw new errorHandler.AppError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, 400);
      }
    }
    
    return await userRepository.update(user, {
      name: updateData.name || user.name,
      email: updateData.email || user.email,
      password_hash: updateData.password || user.password_hash,
      phone: updateData.phone || user.phone
    });
  }
  
  // Get all users with pagination and filtering
  async getAllUsers(filters, pagination, sorting) {
    const whereClause = {};
    
    if (filters.role) {
      whereClause.role = filters.role;
    }
    
    const { limit, offset } = pagination;
    const order = sorting;
    
    const { users, total } = await userRepository.findAll(whereClause, limit, offset, order);
    
    return {
      total,
      users,
      page: Math.floor(offset / limit) + 1,
      limit
    };
  }
  
  // Get user by ID
  async getUserById(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    return user;
  }
  
  // Update user by ID (admin)
  async updateUserById(userId, updateData) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    
    // Check if email is already in use by another user
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await userRepository.findByEmail(updateData.email);
      if (existingUser) {
        throw new errorHandler.AppError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, 400);
      }
    }
    
    return await userRepository.update(user, {
      name: updateData.name || user.name,
      email: updateData.email || user.email,
      password_hash: updateData.password || user.password_hash,
      phone: updateData.phone || user.phone,
      role: updateData.role || user.role,
      is_active: updateData.is_active !== undefined ? updateData.is_active : user.is_active
    });
  }
  
  // Delete user (soft delete)
  async deleteUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    
    // Soft delete by setting is_active to false
    return await userRepository.update(user, { is_active: false });
  }
}

module.exports = new UserService(); 