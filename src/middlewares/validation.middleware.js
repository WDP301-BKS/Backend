const Joi = require('joi');
const { errorHandler, constants } = require('../common');
const { BadRequestError } = errorHandler;
const { USER_ROLES } = constants;

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new BadRequestError(errorMessage));
    }
    
    next();
  };
};

// Validation schemas
const schemas = {
  register: Joi.object({
    name: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().pattern(/^[0-9+]{10,15}$/),
    role: Joi.string().valid(USER_ROLES.CUSTOMER, USER_ROLES.OWNER).default(USER_ROLES.CUSTOMER)
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  resendVerification: Joi.object({
    email: Joi.string().email().required()
  }),
  
  googleAuth: Joi.object({
    tokenId: Joi.string().required(),
    profileObj: Joi.object({
      email: Joi.string().email().required(),
      name: Joi.string().required(),
      imageUrl: Joi.string().uri().optional().allow('', null),
      googleId: Joi.string().required(),
      role: Joi.string().valid(USER_ROLES.CUSTOMER, USER_ROLES.OWNER).default(USER_ROLES.CUSTOMER)
    }).required()
  }),
  
  updateUser: Joi.object({
    name: Joi.string().min(3).max(50),
    email: Joi.string().email(),
    password: Joi.string().min(6),
    phone: Joi.string().pattern(/^[0-9+]{10,15}$/),
    bio: Joi.string().max(500),
    gender: Joi.string().valid('male', 'female', 'other'),
    dateOfBirth: Joi.date(),
    address: Joi.string().max(200),
    is_active: Joi.boolean()
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
  }),
  
  forgotPassword: Joi.object({
    email: Joi.string().email().required()
  }),
  
  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
  })
};

module.exports = {
  validateRequest,
  schemas
}; 