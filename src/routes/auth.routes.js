const express = require('express');
const { register, login, googleAuth } = require('../controllers/auth.controller');
const { validateRequest, schemas } = require('../middlewares/validation.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', validateRequest(schemas.register), register);

/**
 * @route POST /api/auth/login
 * @desc Login a user
 * @access Public
 */
router.post('/login', validateRequest(schemas.login), login);

/**
 * @route POST /api/auth/google
 * @desc Google authentication
 * @access Public
 */
router.post('/google', validateRequest(schemas.googleAuth), googleAuth);

/**
 * @route GET /api/auth/me
 * @desc Get current user info
 * @access Private
 */
router.get('/me', authMiddleware, (req, res) => {
  // User is attached to req by authMiddleware
  return res.status(200).json({
    success: true,
    user: req.user
  });
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user (just for API completeness)
 * @access Public
 */
router.post('/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router; 