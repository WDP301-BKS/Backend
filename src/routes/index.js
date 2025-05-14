const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');

const router = express.Router();

// Mount auth routes
router.use('/auth', authRoutes);

// Mount user routes 
router.use('/users', userRoutes);

module.exports = router; 