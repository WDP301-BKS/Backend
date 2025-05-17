const { User } = require('../models');
const { Op } = require('sequelize');

class AuthRepository {
  // Find user by email
  async findByEmail(email) {
    return await User.findOne({ where: { email } });
  }

  // Find user by googleId or email
  async findByGoogleIdOrEmail(googleId, email) {
    return await User.findOne({ 
      where: { 
        [Op.or]: [
          { googleId },
          { email }
        ]
      } 
    });
  }

  // Create a new user
  async createUser(userData) {
    return await User.create(userData);
  }

  // Update user
  async updateUser(user, updateData) {
    // Handle if user is an ID or an object
    if (typeof user === 'string' || typeof user === 'number') {
      const userObj = await User.findByPk(user);
      if (!userObj) {
        throw new Error('User not found');
      }
      return await userObj.update(updateData);
    }
    // If user is already an object
    return await user.update(updateData);
  }
}

module.exports = new AuthRepository(); 