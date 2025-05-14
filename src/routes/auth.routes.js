const express = require('express');
const { register, login, googleAuth } = require('../controllers/auth.controller');
const { validateRequest, schemas } = require('../middlewares/validation.middleware');

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

module.exports = router; 