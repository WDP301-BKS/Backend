const { authRepository } = require('../repositories');
const { 
  jwtUtils, 
  passwordUtils, 
  constants,
  errorHandler
} = require('../common');

const { USER_ROLES, CONFIG, ERROR_MESSAGES } = constants;

class AuthService {
  // Register a new user
  async register(userData) {
    const { name, email, password, phone, role } = userData;

    if (!password) {
      throw new errorHandler.AppError("Password is required", 400);
    }

    // Check if email already exists
    const existingUser = await authRepository.findByEmail(email);
    if (existingUser) {
      throw new errorHandler.AppError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, 400);
    }

    // Create new user
    const user = await authRepository.createUser({
      name,
      email,
      password_hash: password, // Will be hashed by Sequelize hooks
      phone,
      role: role || USER_ROLES.CUSTOMER
    });

    // Generate token
    const token = jwtUtils.generateToken({ id: user.id }, CONFIG.JWT_EXPIRATION);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    };
  }

  // Login user
  async login(credentials) {
    const { email, password } = credentials;

    // Find user by email
    const user = await authRepository.findByEmail(email);
    
    if (!user) {
      throw new errorHandler.AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    // Check if account is active
    if (!user.is_active) {
      throw new errorHandler.AppError(ERROR_MESSAGES.ACCOUNT_INACTIVE, 403);
    }

    // Validate password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      throw new errorHandler.AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
    }

    // Generate token
    const token = jwtUtils.generateToken({ id: user.id }, CONFIG.JWT_EXPIRATION);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    };
  }

  // Google login or registration
  async googleAuth(googleData) {
    try {
      const { profileObj, tokenId } = googleData;
      
      if (!profileObj || !profileObj.email) {
        throw new errorHandler.AppError('Invalid Google profile data', 400);
      }

      // Log the inputs for debugging
      console.log('Google auth input data:', JSON.stringify({
        email: profileObj.email,
        name: profileObj.name,
        googleId: profileObj.googleId,
        role: profileObj.role
      }, null, 2));

      const { email, name, googleId } = profileObj;
      
      // Validate role value for NEW users only
      const requestedRole = (profileObj.role && 
        (profileObj.role === USER_ROLES.OWNER || profileObj.role === USER_ROLES.CUSTOMER)) 
        ? profileObj.role 
        : USER_ROLES.CUSTOMER;
      
      // Check if user exists by googleId or email
      let user = await authRepository.findByGoogleIdOrEmail(googleId, email);
      
      if (user) {
        // User already exists - KEEP EXISTING ROLE
        console.log('User already exists with role:', user.role);
        
        // Only update googleId if needed, do NOT change role
        if (!user.googleId && googleId) {
          user = await authRepository.updateUser(user.id, { googleId });
        }
      } else {
        // Create new user with requested role
        console.log('Creating new user with role:', requestedRole);
        const randomPassword = passwordUtils.generateRandomPassword();
        user = await authRepository.createUser({
          name,
          email,
          googleId,
          password_hash: randomPassword, // Will be hashed by Sequelize hooks
          role: requestedRole
        });
      }
      
      // Check if account is active
      if (!user.is_active) {
        throw new errorHandler.AppError(ERROR_MESSAGES.ACCOUNT_INACTIVE, 403);
      }
      
      // Generate token
      const token = jwtUtils.generateToken({ id: user.id }, CONFIG.JWT_EXPIRATION);
      
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      };
    } catch (error) {
      console.error('Google auth error:', error);
      throw error;
    }
  }
}

module.exports = new AuthService(); 