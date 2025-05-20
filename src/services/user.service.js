const { User } = require('../models');
const { errorHandler, constants } = require('../common');
const { ERROR_MESSAGES } = constants;

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
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    return user;
  }
  
  async updateCurrentUser(userId, updateData) {
    const user = await this.findById(userId);
    if (!user) {
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await this.findByEmail(updateData.email);
      if (existingUser) {
        throw new errorHandler.AppError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, 400);
      }
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
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    return user;
  }
  
  async updateUserById(userId, updateData) {
    const user = await this.findById(userId);
    if (!user) {
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await this.findByEmail(updateData.email);
      if (existingUser) {
        throw new errorHandler.AppError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, 400);
      }
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
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    
    return await this.update(user, { is_active: false });
  }
}

module.exports = new UserService(); 