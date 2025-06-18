const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const ownerRoutes = require('./owner.routes');
const fieldRoutes = require('./field.routes');
const chatRoutes = require('./chat.routes');
const favorite = require('./favorite.routes');
const reviewRoutes = require('./review.routes');
const bookingRoutes = require('./booking.routes');
const paymentRoutes = require('./payment.routes');
const timeSlotRoutes = require('./timeslot.routes');

const adminRoutes = require('./admin.routes');

const router = express.Router();

// Mount auth routes
router.use('/auth', authRoutes);

// Mount user routes 
router.use('/users', userRoutes);

// Mount owner routes
router.use('/owners', ownerRoutes);

// Mount field routes
router.use('/fields', fieldRoutes);

// Mount chat routes
router.use('/chats', chatRoutes);

router.use('/favorites', favorite);
router.use('/reviews', reviewRoutes);

router.use('/admin', adminRoutes);

// Mount booking routes
router.use('/bookings', bookingRoutes);

// Mount payment routes
router.use('/payments', paymentRoutes);

module.exports = router; 
// Mount timeslot routes
router.use('/slots', timeSlotRoutes);

module.exports = router;
