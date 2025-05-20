const { User } = require('../models');
const { 
  errorHandler, 
  constants, 
  validationUtils, 
  passwordUtils 
} = require('../common');
const { ERROR_MESSAGES, HTTP_STATUS } = constants;
const { 
  AppError, 
  NotFoundError, 
  BadRequestError,
  UnauthorizedError,
  ForbiddenError
} = errorHandler;

class UserService {
  // Repository methods integrated directly into service
  async findById(id) {
    return await User.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });
  }

  async findByEmail(email) {
    return await User.findOne({ where: { email } });
  }

  async findAll(whereClause, limit, offset, order) {
    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password_hash'] },
      order,
      limit,
      offset
    });
    
    const total = await User.count({ where: whereClause });
    
    return { users, total };
  }

  async create(userData) {
    return await User.create(userData);
  }

  async update(user, updateData) {
    return await user.update(updateData);
  }

  async count(whereClause) {
    return await User.count({ where: whereClause });
  }

  // Service methods
  async getCurrentUser(userId) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return user;
  }
  
  async updateCurrentUser(userId, updateData) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    
    // Validate email if updating
    if (updateData.email) {
      if (!validationUtils.isValidEmail(updateData.email)) {
        throw new BadRequestError("Invalid email format");
      }
      
      if (updateData.email !== user.email) {
        const existingUser = await this.findByEmail(updateData.email);
        if (existingUser) {
          throw new BadRequestError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
        }
      }
    }
    
    // Validate password if updating
    if (updateData.password && !validationUtils.isStrongPassword(updateData.password)) {
      throw new BadRequestError("Password must be at least 8 characters and include uppercase, lowercase, and numbers");
    }
    
    // Validate phone if updating
    if (updateData.phone && !validationUtils.isValidVietnamesePhone(updateData.phone)) {
      throw new BadRequestError("Invalid Vietnamese phone number format");
    }
    
    return await this.update(user, {
      name: updateData.name || user.name,
      email: updateData.email || user.email,
      password_hash: updateData.password || user.password_hash,
      phone: updateData.phone || user.phone
    });
  }
  
  async getAllUsers(filters, pagination, sorting) {
    const whereClause = {};
    
    if (filters.role) {
      whereClause.role = filters.role;
    }
    
    const { limit, offset } = pagination;
    const order = sorting;
    
    const { users, total } = await this.findAll(whereClause, limit, offset, order);
    
    return {
      total,
      users,
      page: Math.floor(offset / limit) + 1,
      limit
    };
  }
  
  async getUserById(userId) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return user;
  }
  
  async updateUserById(userId, updateData) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    
    // Validate email if updating
    if (updateData.email) {
      if (!validationUtils.isValidEmail(updateData.email)) {
        throw new BadRequestError("Invalid email format");
      }
      
      if (updateData.email !== user.email) {
        const existingUser = await this.findByEmail(updateData.email);
        if (existingUser) {
          throw new BadRequestError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
        }
      }
    }
    
    // Validate password if updating
    if (updateData.password && !validationUtils.isStrongPassword(updateData.password)) {
      throw new BadRequestError("Password must be at least 8 characters and include uppercase, lowercase, and numbers");
    }
    
    // Validate phone if updating
    if (updateData.phone && !validationUtils.isValidVietnamesePhone(updateData.phone)) {
      throw new BadRequestError("Invalid Vietnamese phone number format");
    }
    
    return await this.update(user, {
      name: updateData.name || user.name,
      email: updateData.email || user.email,
      password_hash: updateData.password || user.password_hash,
      phone: updateData.phone || user.phone,
      role: updateData.role || user.role,
      is_active: updateData.is_active !== undefined ? updateData.is_active : user.is_active
    });
  }
  
  async deleteUser(userId) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    
    return await this.update(user, { is_active: false });
  }
}

module.exports = new UserService(); 