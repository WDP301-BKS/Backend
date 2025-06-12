const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Public routes
router.get('/field/:fieldId/availability', bookingController.getFieldAvailability);

// Protected routes (require authentication) - specific routes first to avoid conflicts
router.get('/user', authMiddleware, bookingController.getUserBookings);
router.post('/', authMiddleware, bookingController.createBooking);
router.get('/:id', authMiddleware, bookingController.getBookingById); 
router.put('/:id/cancel', authMiddleware, bookingController.cancelBooking);

module.exports = router;
