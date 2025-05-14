const { User } = require('../models');

class UserRepository {
  // Find user by id
  async findById(id) {
    return await User.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });
  }

  // Find user by email
  async findByEmail(email) {
    return await User.findOne({ where: { email } });
  }

  // Get all users with pagination and filtering
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

  // Create a new user
  async create(userData) {
    return await User.create(userData);
  }

  // Update a user
  async update(user, updateData) {
    return await user.update(updateData);
  }

  // Count users
  async count(whereClause) {
    return await User.count({ where: whereClause });
  }
}

module.exports = new UserRepository(); 