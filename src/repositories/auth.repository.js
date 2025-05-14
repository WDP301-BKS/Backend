const { User, sequelize } = require('../models');

class AuthRepository {
  // Find user by email
  async findByEmail(email) {
    return await User.findOne({ where: { email } });
  }

  // Find user by googleId or email
  async findByGoogleIdOrEmail(googleId, email) {
    return await User.findOne({ 
      where: { 
        [sequelize.Op.or]: [
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
    return await user.update(updateData);
  }
}

module.exports = new AuthRepository(); 