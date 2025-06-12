const { Booking, TimeSlot, Field, User, SubField, Location } = require('../models');
const { ValidationError, Op } = require('sequelize');
const { sequelize } = require('../config/db.config');
const responseFormatter = require('../utils/responseFormatter');
const dbOptimizer = require('../utils/dbOptimizer');
const retryMechanism = require('../utils/retryMechanism');
const performanceMonitor = require('../utils/performanceMonitorNew');

// Get field availability for a specific date with optimized performance
const getFieldAvailability = async (req, res) => {
    const operationId = performanceMonitor.startOperation('get_field_availability', {
        type: 'booking_availability',
        fieldId: req.params.fieldId,
        date: req.query.date
    });

    try {
        const { fieldId } = req.params;
        const { date } = req.query;

        if (!date) {
            performanceMonitor.endOperation(operationId, { error: 'VALIDATION_ERROR' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Ngày không được để trống'
            }));
        }

        // Use optimized availability check
        const availabilityResult = await retryMechanism.executeDatabaseOperation(
            () => dbOptimizer.checkAvailabilityOptimized(fieldId, date, []),
            'availability_check'
        );

        performanceMonitor.endOperation(operationId, { success: true });

        return res.json(responseFormatter.success({
            fieldId,
            date,
            unavailableSlots: availabilityResult.unavailableSlots || [],
            isAvailable: availabilityResult.isAvailable,
            conflicts: availabilityResult.conflicts || []
        }));

    } catch (error) {
        console.error('Error in getFieldAvailability:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        performanceMonitor.monitorBookingOperation('availability_check', req.params.fieldId, 0, false, error.message);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi kiểm tra tình trạng sân',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
};

// Create a new booking
const createBooking = async (req, res) => {
    const operationId = performanceMonitor.startOperation('create_booking', {
        type: 'booking_creation',
        userId: req.user?.id,
        fieldId: req.body.fieldId
    });

    try {
        const userId = req.user?.id;

        // Check if user is authenticated
        if (!userId) {
            performanceMonitor.endOperation(operationId, { error: 'UNAUTHORIZED' });
            return res.status(401).json(responseFormatter.error({
                code: 'UNAUTHORIZED',
                message: 'Bạn cần đăng nhập để đặt sân'
            }));
        }

        const {
            fieldId,
            subFieldIds,
            bookingDate,
            timeSlots,
            totalAmount,
            customerInfo,
            paymentMethod
        } = req.body;

        // Validate required fields
        if (!fieldId || !subFieldIds || !bookingDate || !timeSlots || !totalAmount) {
            performanceMonitor.endOperation(operationId, { error: 'VALIDATION_ERROR' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Thiếu thông tin bắt buộc'
            }));
        }

        // Check if field exists with retry mechanism
        const field = await retryMechanism.executeDatabaseOperation(
            () => Field.findByPk(fieldId),
            'field_lookup'
        );

        if (!field) {
            performanceMonitor.endOperation(operationId, { error: 'NOT_FOUND' });
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Không tìm thấy sân bóng'
            }));
        }

        // Use atomic booking creation with proper transaction and locking
        const bookingResult = await retryMechanism.executeDatabaseOperation(
            () => dbOptimizer.createBookingAtomically(fieldId, bookingDate, timeSlots, {
                user_id: userId,
                booking_date: new Date(),
                status: 'pending',
                total_price: totalAmount,
                payment_status: 'pending',
                customer_info: customerInfo || null
            }),
            'atomic_booking_creation'
        );

        // Check if booking creation failed due to conflicts
        if (bookingResult.error) {
            performanceMonitor.endOperation(operationId, { error: bookingResult.code });
            return res.status(409).json(responseFormatter.error({
                code: bookingResult.code,
                message: bookingResult.message,
                details: bookingResult.details
            }));
        }

        const booking = bookingResult;

        // Monitor booking operation
        performanceMonitor.monitorBookingOperation('create', fieldId, totalAmount, true);

        // Return booking details with optimized lookup
        const bookingWithDetails = await retryMechanism.executeDatabaseOperation(
            () => dbOptimizer.getBookingWithDetails(booking.id),
            'booking_details_lookup'
        );

        performanceMonitor.endOperation(operationId, { success: true, bookingId: booking.id });

        return res.status(201).json(responseFormatter.success(bookingWithDetails));

    } catch (error) {
        console.error('Error in createBooking:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        performanceMonitor.monitorBookingOperation('create', req.body.fieldId, req.body.totalAmount, false, error.message);
        
        if (error instanceof ValidationError) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Dữ liệu không hợp lệ',
                details: error.errors.reduce((acc, curr) => {
                    acc[curr.path] = curr.message;
                    return acc;
                }, {})
            }));
        }
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi tạo đặt sân'
        }));
    }
};

// Get user's bookings (for authenticated users)
const getUserBookings = async (req, res) => {
    const operationId = performanceMonitor.startOperation('get_user_bookings', {
        type: 'booking_lookup',
        userId: req.user?.id
    });

    try {
        const userId = req.user?.id;
        if (!userId) {
            performanceMonitor.endOperation(operationId, { error: 'UNAUTHORIZED' });
            return res.status(401).json(responseFormatter.error({
                code: 'UNAUTHORIZED',
                message: 'Bạn cần đăng nhập để xem lịch sử đặt sân'
            }));
        }

        // Use optimized batch lookup for user bookings
        const bookings = await retryMechanism.executeDatabaseOperation(
            () => dbOptimizer.getUserBookingsOptimized(userId),
            'user_bookings_lookup'
        );

        performanceMonitor.endOperation(operationId, { success: true, bookingCount: bookings.length });

        return res.json(responseFormatter.success(bookings));

    } catch (error) {
        console.error('Error in getUserBookings:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi lấy lịch sử đặt sân'
        }));
    }
};

// Cancel booking (for authenticated users)
const cancelBooking = async (req, res) => {
    const operationId = performanceMonitor.startOperation('cancel_booking', {
        type: 'booking_cancellation',
        bookingId: req.params.id,
        userId: req.user?.id
    });

    try {
        const { id } = req.params;
        const userId = req.user?.id;

        // Use optimized booking lookup with retry
        const booking = await retryMechanism.executeDatabaseOperation(
            () => Booking.findOne({
                where: {
                    id,
                    user_id: userId
                }
            }),
            'booking_lookup'
        );

        if (!booking) {
            performanceMonitor.endOperation(operationId, { error: 'NOT_FOUND' });
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Không tìm thấy đặt sân'
            }));
        }

        if (booking.status === 'cancelled') {
            performanceMonitor.endOperation(operationId, { error: 'ALREADY_CANCELLED' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Đặt sân đã được hủy trước đó'
            }));
        }

        // Update booking status with retry mechanism
        await retryMechanism.executeDatabaseOperation(
            () => booking.update({
                status: 'cancelled',
                payment_status: 'refunded'
            }),
            'booking_cancellation'
        );

        // Free up the time slots with retry mechanism
        await retryMechanism.executeDatabaseOperation(
            () => TimeSlot.update(
                { is_available: true, booking_id: null },
                { where: { booking_id: booking.id } }
            ),
            'timeslot_release'
        );

        // Monitor booking operation
        performanceMonitor.monitorBookingOperation('cancel', id, booking.total_price, true);
        performanceMonitor.endOperation(operationId, { success: true });

        return res.json(responseFormatter.success({
            message: 'Đã hủy đặt sân thành công'
        }));

    } catch (error) {
        console.error('Error in cancelBooking:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        performanceMonitor.monitorBookingOperation('cancel', req.params.id, 0, false, error.message);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi hủy đặt sân'
        }));
    }
};

// Get booking by ID (for authenticated users only)
const getBookingById = async (req, res) => {
    const operationId = performanceMonitor.startOperation('get_booking_by_id', {
        type: 'booking_lookup',
        bookingId: req.params.id,
        userId: req.user?.id
    });

    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            performanceMonitor.endOperation(operationId, { error: 'UNAUTHORIZED' });
            return res.status(401).json(responseFormatter.error({
                code: 'UNAUTHORIZED',
                message: 'Bạn cần đăng nhập để xem thông tin booking'
            }));
        }

        // Find the booking for this user
        const booking = await retryMechanism.executeDatabaseOperation(
            () => Booking.findOne({
                where: {
                    id,
                    user_id: userId
                },
                include: [
                    {
                        model: TimeSlot,
                        include: [{
                            model: SubField,
                            include: [{
                                model: Field,
                                include: [{ model: Location }]
                            }]
                        }]
                    }
                ]
            }),
            'booking_lookup'
        );

        if (!booking) {
            performanceMonitor.endOperation(operationId, { error: 'NOT_FOUND' });
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Không tìm thấy booking'
            }));
        }

        performanceMonitor.endOperation(operationId, { success: true });

        return res.json(responseFormatter.success(booking));

    } catch (error) {
        console.error('Error in getBookingById:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi lấy thông tin booking'
        }));
    }
};

module.exports = {
    getFieldAvailability,
    createBooking,
    getUserBookings,
    cancelBooking,
    getBookingById
};
