const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const ownerRoutes = require('./owner.routes');
const fieldRoutes = require('./field.routes');

const router = express.Router();

// Mount auth routes
router.use('/auth', authRoutes);

// Mount user routes 
router.use('/users', userRoutes);

// Mount owner routes
router.use('/owners', ownerRoutes);
// Mount field routes
router.use('/fields', fieldRoutes);

module.exports = router; 