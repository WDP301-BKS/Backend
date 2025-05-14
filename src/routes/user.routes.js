const express = require('express');
const {
  getCurrentUser,
  updateCurrentUser,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUser
} = require('../controllers/user.controller');
const { authMiddleware, isAdmin } = require('../middlewares/auth.middleware');
const { validateRequest, schemas } = require('../middlewares/validation.middleware');

const router = express.Router();

/**
 * @route GET /api/users/profile
 * @desc Get current user profile
 * @access Private (Any authenticated user)
 */
router.get('/profile', authMiddleware, getCurrentUser);

/**
 * @route PUT /api/users/profile
 * @desc Update current user profile
 * @access Private (Any authenticated user)
 */
router.put('/profile', [authMiddleware, validateRequest(schemas.updateUser)], updateCurrentUser);

/**
 * @route GET /api/users
 * @desc Get all users
 * @access Private (Admin only)
 */
router.get('/', [authMiddleware, isAdmin], getAllUsers);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private (Admin only)
 */
router.get('/:id', [authMiddleware, isAdmin], getUserById);

/**
 * @route PUT /api/users/:id
 * @desc Update user by ID
 * @access Private (Admin only)
 */
router.put('/:id', [authMiddleware, isAdmin, validateRequest(schemas.updateUser)], updateUserById);

/**
 * @route DELETE /api/users/:id
 * @desc Delete user (soft delete)
 * @access Private (Admin only)
 */
router.delete('/:id', [authMiddleware, isAdmin], deleteUser);

module.exports = router; 