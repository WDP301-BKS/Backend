const { Booking, TimeSlot, Field, User, SubField, Location, Payment, FieldPricingRule } = require('../models');
const { ValidationError, Op } = require('sequelize');
const { sequelize } = require('../config/db.config');
const responseFormatter = require('../utils/responseFormatter');
const dbOptimizer = require('../utils/dbOptimizer');
const retryMechanism = require('../utils/retryMechanism');
const performanceMonitor = require('../utils/performanceMonitorNew');
const { emitBookingStatusUpdate, emitBookingPaymentUpdate, emitBookingEvent } = require('../config/socket.config');

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

        // 🔧 DEBUG: Log the incoming request data
        console.log('🔍 CREATE BOOKING REQUEST DEBUG:');
        console.log('📋 fieldId:', fieldId);
        console.log('📋 subFieldIds:', subFieldIds);
        console.log('📋 bookingDate:', bookingDate);
        console.log('📋 timeSlots:', JSON.stringify(timeSlots, null, 2));
        console.log('📋 totalAmount:', totalAmount);
        console.log('📋 Full request body:', JSON.stringify(req.body, null, 2));

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
                status: 'payment_pending', // Start with payment_pending status
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
        const { reason, refundMethod } = req.body;

        // Validate required fields
        if (!reason) {
            performanceMonitor.endOperation(operationId, { error: 'VALIDATION_ERROR' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Vui lòng cung cấp lý do hủy đặt sân'
            }));
        }

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

        // Kiểm tra trạng thái thanh toán để xử lý refund
        const needsStripeRefund = booking.status === 'confirmed' && 
                                 booking.payment_status === 'paid' && 
                                 booking.total_price > 0;

        let refundAmount = 0;
        let stripeRefundId = null;

        if (needsStripeRefund) {
            console.log('🔄 Processing Stripe refund for booking:', booking.id);
            
            try {
                // Tìm payment record để lấy Stripe payment intent ID
                const payment = await Payment.findOne({
                    where: { booking_id: booking.id }
                });

                if (!payment || !payment.stripe_payment_intent_id) {
                    throw new Error('Không tìm thấy thông tin thanh toán để hoàn tiền');
                }

                // Tạo refund qua Stripe
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                const refund = await stripe.refunds.create({
                    payment_intent: payment.stripe_payment_intent_id,
                    amount: Math.round(booking.total_price), // VND amount
                    reason: 'requested_by_customer',
                    metadata: {
                        booking_id: booking.id,
                        cancellation_reason: reason,
                        user_id: userId
                    }
                });

                stripeRefundId = refund.id;
                refundAmount = booking.total_price;

                // Cập nhật payment record với refund info
                await payment.update({
                    status: 'refunded',
                    refund_amount: refundAmount,
                    refund_reason: reason,
                    stripe_refund_id: refund.id,
                    updated_at: new Date()
                });

                console.log('✅ Stripe refund created successfully:', refund.id);

            } catch (stripeError) {
                console.error('❌ Error creating Stripe refund:', stripeError);
                performanceMonitor.endOperation(operationId, { error: 'REFUND_FAILED' });
                return res.status(500).json(responseFormatter.error({
                    code: 'REFUND_ERROR',
                    message: 'Không thể xử lý hoàn tiền. Vui lòng liên hệ hỗ trợ.',
                    details: stripeError.message
                }));
            }
        } else {
            // Trường hợp chưa thanh toán - chỉ hủy booking
            refundAmount = booking.deposit_amount || 0;
        }

        // Calculate refund amount for non-Stripe cases
        if (!needsStripeRefund) {
            refundAmount = booking.deposit_amount || 0;
        }

        // Update booking status with cancellation details
        const updateData = {
            status: 'cancelled',
            payment_status: needsStripeRefund ? 'refunded' : 'cancelled',
            cancellation_reason: reason,
            refund_method: needsStripeRefund ? 'stripe_refund' : refundMethod,
            refund_amount: refundAmount,
            cancelled_at: new Date(),
            updated_at: new Date()
        };

        if (stripeRefundId) {
            updateData.stripe_refund_id = stripeRefundId;
        }

        await retryMechanism.executeDatabaseOperation(
            () => booking.update(updateData),
            'booking_cancellation'
        );

        // Free up the time slots for re-booking but keep relationship for history
        await retryMechanism.executeDatabaseOperation(
            () => TimeSlot.update(
                { status: 'available' }, // Chỉ set available, giữ nguyên booking_id để lưu history
                { where: { booking_id: booking.id } }
            ),
            'timeslot_release'
        );

        // Monitor booking operation
        performanceMonitor.monitorBookingOperation('cancel', id, booking.total_price, true);
        performanceMonitor.endOperation(operationId, { success: true });

        // 📧 EMAIL POLICY: No email notifications are sent for booking cancellations
        // This is intentional business logic:
        // - payment_pending bookings: No email sent since customer hasn't paid yet
        // - confirmed bookings: No email sent for regular cancellations (only maintenance cancellations send email)
        // - Email notifications are only sent for maintenance-related cancellations (see cancelBookingForMaintenance)
        console.log(`📧 Email policy: No email sent for booking cancellation (status: ${booking.status})`);

        // Emit real-time notifications for booking cancellation
        try {
            // Emit booking status update
            emitBookingStatusUpdate(booking.id, {
                status: 'cancelled',
                payment_status: needsStripeRefund ? 'refunded' : 'cancelled',
                userId: booking.user_id,
                bookingId: booking.id,
                refundAmount: refundAmount,
                cancellationReason: reason,
                timestamp: new Date().toISOString(),
                message: needsStripeRefund 
                    ? 'Booking cancelled and refund processed'
                    : 'Booking cancelled successfully'
            });

            // Emit general booking event for broader notifications
            emitBookingEvent('booking_cancelled', booking.id, {
                userId: booking.user_id,
                bookingId: booking.id,
                status: 'cancelled',
                payment_status: needsStripeRefund ? 'refunded' : 'cancelled',
                refundAmount: refundAmount,
                wasStripeRefund: needsStripeRefund,
                timestamp: new Date().toISOString(),
                refresh_needed: true, // Flag để frontend biết cần refresh
                message: needsStripeRefund 
                    ? 'Your booking has been cancelled and refund is being processed'
                    : 'Your booking has been cancelled successfully'
            });

            console.log('✅ Real-time notifications sent for booking cancellation:', booking.id);

        } catch (socketError) {
            // Log socket errors but don't fail the cancellation
            console.error('❌ Error sending real-time notifications (cancellation still succeeded):', socketError);
        }

        return res.json(responseFormatter.success({
            message: needsStripeRefund 
                ? 'Đã hủy đặt sân và hoàn tiền thành công' 
                : 'Đã hủy đặt sân thành công',
            data: {
                bookingId: booking.id,
                refundAmount: refundAmount,
                refundMethod: needsStripeRefund ? 'stripe_refund' : refundMethod,
                cancellationReason: reason,
                stripeRefundId: stripeRefundId,
                wasStripeRefund: needsStripeRefund
            }
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
                        as: 'timeSlots',
                        include: [{
                            model: SubField,
                            as: 'subfield',
                            include: [{
                                model: Field,
                                as: 'field',
                                include: [{ model: Location, as: 'location' }]
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

// Get booking statistics (for authenticated users)
const getBookingStats = async (req, res) => {
    const operationId = performanceMonitor.startOperation('get_booking_stats', {
        type: 'booking_stats',
        userId: req.user?.id
    });

    try {
        const userId = req.user?.id;
        if (!userId) {
            performanceMonitor.endOperation(operationId, { error: 'UNAUTHORIZED' });
            return res.status(401).json(responseFormatter.error({
                code: 'UNAUTHORIZED',
                message: 'Bạn cần đăng nhập để xem thống kê'
            }));
        }

        // Use optimized stats query from dbOptimizer
        const stats = await retryMechanism.executeDatabaseOperation(
            () => dbOptimizer.getBookingStatsOptimized({ userId }),
            'booking_stats_lookup'
        );

        performanceMonitor.endOperation(operationId, { success: true });

        return res.json(responseFormatter.success({
            totalBookings: parseInt(stats.total_bookings) || 0,
            totalHours: parseInt(stats.total_hours) || 0,
            totalSpent: parseFloat(stats.total_revenue) || 0,
            confirmedBookings: parseInt(stats.confirmed_bookings) || 0,
            pendingBookings: parseInt(stats.pending_bookings) || 0,
            cancelledBookings: parseInt(stats.cancelled_bookings) || 0,
            paidBookings: parseInt(stats.paid_bookings) || 0,
            averageBookingValue: parseFloat(stats.average_booking_value) || 0
        }));

    } catch (error) {
        console.error('Error in getBookingStats:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi lấy thống kê booking'
        }));
    }
};

// Test email functionality - For development/testing purposes only
const testEmail = async (req, res) => {
    try {
        const { sendBookingConfirmationEmail, sendOwnerBookingNotificationEmail } = require('../utils/emailService');
        
        // Mock booking details for testing
        const mockBookingDetails = {
            fieldName: 'Sân bóng ABC',
            customerName: 'Nguyễn Văn A',
            customerEmail: 'customer@example.com',
            customerPhone: '0123456789',
            date: 'Thứ Hai, 17 tháng 6, 2025',
            startTime: '08:00',
            endTime: '10:00',
            totalAmount: '500.000 ₫'
        };

        const { type, email } = req.body;

        if (!email) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Email is required'
            }));
        }

        let result;
        if (type === 'customer') {
            result = await sendBookingConfirmationEmail(email, 'Khách hàng thử nghiệm', mockBookingDetails);
        } else if (type === 'owner') {
            result = await sendOwnerBookingNotificationEmail(email, 'Chủ sân thử nghiệm', mockBookingDetails);
        } else {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Type must be either "customer" or "owner"'
            }));
        }

        return res.json(responseFormatter.success({
            message: 'Test email sent successfully',
            type,
            email,
            result
        }));

    } catch (error) {
        console.error('Error sending test email:', error);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to send test email',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
};

// Process payment for booking
const processPayment = async (req, res) => {
    const operationId = performanceMonitor.startOperation('process_payment', {
        type: 'booking_payment',
        bookingId: req.params.id,
        userId: req.user?.id
    });

    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const { paymentMethod, amount, isFullPayment } = req.body;

        // Validate required fields
        if (!paymentMethod || !amount) {
            performanceMonitor.endOperation(operationId, { error: 'VALIDATION_ERROR' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Thiếu thông tin thanh toán'
            }));
        }

        // Find booking with retry mechanism
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

        // Check if booking can be paid
        if (booking.status === 'cancelled') {
            performanceMonitor.endOperation(operationId, { error: 'BOOKING_CANCELLED' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Không thể thanh toán cho đặt sân đã bị hủy'
            }));
        }

        if (booking.payment_status === 'completed') {
            performanceMonitor.endOperation(operationId, { error: 'ALREADY_PAID' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Đặt sân đã được thanh toán đầy đủ'
            }));
        }

        // Calculate remaining amount (should be full amount for 100% payment system)
        const paidAmount = booking.deposit_amount || 0;
        const remainingAmount = booking.total_price - paidAmount;

        // For 100% payment system, amount should equal total price
        if (amount !== remainingAmount) {
            performanceMonitor.endOperation(operationId, { error: 'INVALID_AMOUNT' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Vui lòng thanh toán toàn bộ số tiền còn lại'
            }));
        }

        // Update booking payment information (100% payment)
        await retryMechanism.executeDatabaseOperation(
            () => booking.update({
                deposit_amount: booking.total_price, // Full payment
                payment_status: 'completed',
                payment_method: paymentMethod,
                status: 'confirmed',
                updated_at: new Date()
            }),
            'booking_payment_update'
        );

        // Monitor booking operation
        performanceMonitor.monitorBookingOperation('payment', id, amount, true);
        performanceMonitor.endOperation(operationId, { success: true });

        return res.json(responseFormatter.success({
            message: 'Thanh toán thành công',
            data: {
                bookingId: booking.id,
                amountPaid: amount,
                totalPaid: booking.total_price,
                remainingAmount: 0,
                paymentStatus: 'completed',
                bookingStatus: 'confirmed'
            }
        }));

    } catch (error) {
        console.error('Error in processPayment:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        performanceMonitor.monitorBookingOperation('payment', req.params.id, 0, false, error.message);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi xử lý thanh toán'
        }));
    }
};

// Get field availability with pricing information for user booking
const getFieldAvailabilityWithPricing = async (req, res) => {
    const operationId = performanceMonitor.startOperation('get_field_availability_pricing', {
        type: 'booking_availability_pricing',
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

        // Get field info and pricing rules with better error handling
        const field = await Field.findByPk(fieldId, {
            include: [{
                model: FieldPricingRule,
                as: 'pricingRules',
                required: false,
                order: [['from_hour', 'ASC']] // Ensure consistent ordering
            }]
        });

        if (!field) {
            performanceMonitor.endOperation(operationId, { error: 'FIELD_NOT_FOUND' });
            return res.status(404).json(responseFormatter.error({
                code: 'FIELD_NOT_FOUND',
                message: 'Không tìm thấy sân'
            }));
        }

        console.log(`Field ${fieldId} pricing rules:`, field.pricingRules?.length || 0, 'rules found');

        // Get availability data
        const availabilityResult = await retryMechanism.executeDatabaseOperation(
            () => dbOptimizer.checkAvailabilityOptimized(fieldId, date, []),
            'availability_check'
        );

        // Get subfields for price calculation
        const subfields = await SubField.findAll({
            where: { field_id: fieldId },
            attributes: ['id', 'name', 'field_type']
        });

        // Enhance unavailable slots with pricing information
        const unavailableSlotsWithPricing = availabilityResult.unavailableSlots.map(slot => {
            const hour = parseInt(slot.start_time.split(':')[0]);
            
            // Find applicable pricing rule
            const applicableRule = field.pricingRules?.find(
                rule => hour >= rule.from_hour && hour < rule.to_hour
            );
            
            const basePrice = field.price_per_hour || 0;
            const multiplier = applicableRule ? applicableRule.multiplier : 1.0;
            const finalPrice = Math.round(basePrice * multiplier);

            return {
                ...slot,
                base_price: basePrice,
                peak_hour_multiplier: multiplier,
                calculated_price: finalPrice,
                is_peak_hour: multiplier > 1.0
            };
        });

        performanceMonitor.endOperation(operationId, { success: true });

        return res.json(responseFormatter.success({
            fieldId,
            date,
            field: {
                id: field.id,
                name: field.name,
                price_per_hour: field.price_per_hour,
                pricingRules: field.pricingRules || [] // Always return array, never undefined
            },
            subfields: subfields.map(sf => ({
                id: sf.id,
                name: sf.name,
                field_type: sf.field_type
            })),
            unavailableSlots: unavailableSlotsWithPricing,
            isAvailable: availabilityResult.isAvailable,
            conflicts: availabilityResult.conflicts || [],
            // Add debug info
            debug: {
                pricingRulesCount: field.pricingRules?.length || 0,
                basePrice: field.price_per_hour,
                timestamp: new Date().toISOString()
            }
        }));

    } catch (error) {
        console.error('Error in getFieldAvailabilityWithPricing:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi kiểm tra tình trạng sân',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
};

// Cancel booking for maintenance with automatic refund
const cancelBookingForMaintenance = async (req, res) => {
    const operationId = performanceMonitor.startOperation('cancel_booking_maintenance');
    
    try {
        const { bookingId, maintenanceReason } = req.body;
        const userId = req.user.id;
        
        // Validate input
        if (!bookingId || !maintenanceReason) {
            performanceMonitor.endOperation(operationId, { error: 'VALIDATION_ERROR' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Booking ID và lý do bảo trì không được để trống'
            }));
        }
        
        // Find booking with related data
        const booking = await Booking.findOne({
            where: { id: bookingId },
            include: [
                {
                    model: TimeSlot,
                    as: 'timeSlots',
                    include: [{
                        model: SubField,
                        as: 'subfield',
                        include: [{
                            model: Field,
                            as: 'field',
                            attributes: ['id', 'name']
                        }]
                    }]
                }
            ]
        });

        if (!booking) {
            performanceMonitor.endOperation(operationId, { error: 'NOT_FOUND' });
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Không tìm thấy đặt sân'
            }));
        }

        // Get user separately
        const user = await User.findByPk(booking.user_id);
        if (!user) {
            performanceMonitor.endOperation(operationId, { error: 'USER_NOT_FOUND' });
            return res.status(404).json(responseFormatter.error({
                code: 'USER_NOT_FOUND',
                message: 'Không tìm thấy thông tin người dùng'
            }));
        }

        // Check if booking can be cancelled
        if (booking.status === 'cancelled') {
            performanceMonitor.endOperation(operationId, { error: 'ALREADY_CANCELLED' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Đặt sân đã được hủy trước đó'
            }));
        }

        // Protect bookings that are pending payment
        if (booking.status === 'payment_pending') {
            // 🔍 DEBUG: Log details about payment_pending protection
            console.log('🛡️ PAYMENT_PENDING PROTECTION TRIGGERED:');
            console.log('- Booking ID:', booking.id);
            console.log('- Status:', booking.status);
            console.log('- Payment Status:', booking.payment_status);
            console.log('- User ID:', booking.user_id);
            console.log('- Total Price:', booking.total_price);
            console.log('- Created At:', booking.created_at);
            console.log('📧 NO EMAIL WILL BE SENT (payment_pending protection)');
            
            performanceMonitor.endOperation(operationId, { error: 'PAYMENT_PENDING' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Không thể hủy đặt sân đang chờ thanh toán để bảo trì. Vui lòng chờ khách hàng hoàn tất thanh toán hoặc hết hạn thanh toán.'
            }));
        }

        // 🔍 DEBUG: Log details about bookings that WILL be processed
        console.log('📋 PROCESSING MAINTENANCE CANCELLATION:');
        console.log('- Booking ID:', booking.id);
        console.log('- Status:', booking.status);
        console.log('- Payment Status:', booking.payment_status);
        console.log('- User ID:', booking.user_id);
        console.log('- Will send email: YES (confirmed booking)');

        // Process automatic refund (100% for maintenance cancellation)
        const needsStripeRefund = booking.status === 'confirmed' && 
                                 (booking.payment_status === 'paid' || booking.payment_status === 'completed') && 
                                 booking.total_price > 0;

        let refundAmount = 0;
        let stripeRefundId = null;

        if (needsStripeRefund) {
            console.log('🔄 Processing Stripe refund for maintenance cancellation:', booking.id);
            
            try {
                // Find payment record to get Stripe payment intent ID
                const payment = await Payment.findOne({
                    where: { booking_id: booking.id }
                });

                if (!payment || !payment.stripe_payment_intent_id) {
                    console.warn('⚠️ No payment info found for refund, continuing with cancellation');
                } else {
                    // Create refund via Stripe
                    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                    const refund = await stripe.refunds.create({
                        payment_intent: payment.stripe_payment_intent_id,
                        amount: Math.round(booking.total_price), // 100% refund
                        reason: 'requested_by_customer',
                        metadata: {
                            booking_id: booking.id,
                            cancellation_reason: `Bảo trì sân: ${maintenanceReason}`,
                            user_id: booking.user_id,
                            maintenance_cancellation: true
                        }
                    });

                    stripeRefundId = refund.id;
                    refundAmount = booking.total_price;

                    // Update payment record with refund info
                    await payment.update({
                        status: 'refunded',
                        refund_amount: refundAmount,
                        refund_reason: `Bảo trì sân: ${maintenanceReason}`,
                        stripe_refund_id: refund.id,
                        updated_at: new Date()
                    });

                    console.log('✅ Stripe refund created successfully:', refund.id);
                }
            } catch (stripeError) {
                console.error('❌ Error creating Stripe refund:', stripeError);
                // Continue with cancellation even if refund fails
            }
        }

        // Update booking status
        await booking.update({
            status: 'cancelled',
            payment_status: needsStripeRefund ? 'refunded' : booking.payment_status,
            cancellation_reason: `Bảo trì sân: ${maintenanceReason}`,
            cancelled_at: new Date(),
            cancelled_by: userId,
            refund_amount: refundAmount,
            stripe_refund_id: stripeRefundId
        });

        // Update TimeSlots status to maintenance
        if (booking.timeSlots && booking.timeSlots.length > 0) {
            await Promise.all(booking.timeSlots.map(async (timeSlot) => {
                await timeSlot.update({
                    status: 'maintenance',
                    maintenance_reason: maintenanceReason,
                    maintenance_until: null // Will be set when maintenance is scheduled
                });
                
                // Clear cache for this field and date
                const dbOptimizer = require('../utils/dbOptimizer');
                await dbOptimizer.clearAvailabilityCache(timeSlot.sub_field_id, timeSlot.date);
            }));
            console.log('✅ TimeSlots updated to maintenance status and cache cleared');
        }

        // Send notification email to customer
        let emailSent = false;
        try {
            const emailService = require('../utils/emailService');
            
            // Get ALL time slot info instead of just the first one
            const timeSlotInfos = booking.timeSlots ? booking.timeSlots.map(ts => ({
                subField: ts.subfield ? ts.subfield.name || 'N/A' : 'N/A',
                fieldName: ts.subfield && ts.subfield.field ? ts.subfield.field.name : 'Sân bóng',
                startTime: ts.start_time,
                endTime: ts.end_time,
                date: ts.date
            })) : [];
            
            // Get main field name from first time slot
            const mainFieldName = timeSlotInfos.length > 0 ? timeSlotInfos[0].fieldName : 'Sân bóng';
            
            // Format booking date to Vietnamese timezone and format
            const bookingDate = new Date(booking.booking_date);
            const vietnamTime = new Date(bookingDate.getTime() + (7 * 60 * 60 * 1000)); // UTC+7
            const formattedDate = vietnamTime.toLocaleDateString('vi-VN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'Asia/Ho_Chi_Minh'
            });
            
            await emailService.sendMaintenanceCancellationEmail(
                user.email,
                user.name,
                {
                    fieldName: mainFieldName,
                    bookingDate: formattedDate,
                    timeSlots: timeSlotInfos, // Pass all time slots
                    maintenanceReason: maintenanceReason,
                    refundAmount: refundAmount,
                    totalPrice: booking.total_price,
                    willRefund: needsStripeRefund
                }
            );
            emailSent = true;
            console.log('✅ Maintenance cancellation email sent to:', user.email);
        } catch (emailError) {
            console.error('❌ Email notification error:', emailError);
        }

        // Emit socket events for real-time updates
        try {
            const { getSocketInstance } = require('../config/socket.config');
            const io = getSocketInstance();
            
            // Emit booking status update
            emitBookingStatusUpdate(booking.id, 'cancelled', {
                reason: `Bảo trì sân: ${maintenanceReason}`,
                refundAmount: refundAmount,
                maintenanceCancellation: true
            });

            // Emit maintenance event for each affected timeslot
            if (booking.timeSlots && booking.timeSlots.length > 0) {
                booking.timeSlots.forEach(timeSlot => {
                    // Emit to all connected clients (both specific rooms and broadcast)
                    const maintenanceData = {
                        timeSlotId: timeSlot.id,
                        subFieldId: timeSlot.sub_field_id,
                        date: timeSlot.date,
                        startTime: timeSlot.start_time,
                        endTime: timeSlot.end_time,
                        status: 'maintenance',
                        maintenanceReason: maintenanceReason,
                        affectedBookingId: booking.id,
                        timestamp: new Date().toISOString(),
                        refresh_needed: true
                    };
                    
                    // Emit to specific field room
                    io.to(`field-${timeSlot.sub_field_id}`).emit('timeslot_maintenance_set', maintenanceData);
                    
                    // Emit to general maintenance room
                    io.emit('timeslot_maintenance_set', maintenanceData);
                    
                    // Emit booking cancellation event
                    io.emit('booking_cancelled', {
                        bookingId: booking.id,
                        timeSlotId: timeSlot.id,
                        subFieldId: timeSlot.sub_field_id,
                        refresh_needed: true
                    });
                    
                    console.log('📡 Emitted maintenance event for timeslot:', timeSlot.id);
                });
            }

            console.log('✅ Real-time notifications sent for maintenance cancellation');
        } catch (socketError) {
            console.error('❌ Error sending real-time notifications:', socketError);
        }

        performanceMonitor.endOperation(operationId, { success: true });
        return res.json(responseFormatter.success({
            bookingId: booking.id,
            cancelled: true,
            refundAmount: refundAmount,
            emailSent: emailSent,
            maintenanceReason: maintenanceReason
        }, 'Đã hủy booking và hoàn tiền do bảo trì'));

    } catch (error) {
        console.error('❌ Error cancelling booking for maintenance:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi hủy đặt sân'
        }));
    }
};

// Cancel multiple bookings for maintenance with single summary email
const cancelMultipleBookingsForMaintenance = async (req, res) => {
    const operationId = performanceMonitor.startOperation('cancel_multiple_bookings_maintenance');
    
    try {
        const { bookingIds, maintenanceReason } = req.body;
        const userId = req.user.id;
        
        // Validate input
        if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0 || !maintenanceReason) {
            performanceMonitor.endOperation(operationId, { error: 'VALIDATION_ERROR' });
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Danh sách booking IDs và lý do bảo trì không được để trống'
            }));
        }
        
        console.log(`🔄 Processing cancellation for ${bookingIds.length} bookings:`, bookingIds);
        
        const results = [];
        let totalRefundAmount = 0;
        let customerEmails = new Map(); // Group by customer email
        
        // Process each booking
        for (const bookingId of bookingIds) {
            try {
                // 🔍 DEBUG: Log each booking being processed
                console.log(`🔄 Processing booking: ${bookingId}`);
                
                // Find booking with related data
                const booking = await Booking.findOne({
                    where: { id: bookingId },
                    include: [
                        {
                            model: TimeSlot,
                            as: 'timeSlots',
                            include: [{
                                model: SubField,
                                as: 'subfield',
                                include: [{
                                    model: Field,
                                    as: 'field',
                                    attributes: ['id', 'name']
                                }]
                            }]
                        }
                    ]
                });

                if (!booking) {
                    results.push({
                        bookingId,
                        success: false,
                        error: 'Không tìm thấy đặt sân'
                    });
                    continue;
                }

                // Get user info
                const user = await User.findByPk(booking.user_id);
                if (!user) {
                    results.push({
                        bookingId,
                        success: false,
                        error: 'Không tìm thấy thông tin người dùng'
                    });
                    continue;
                }

                // Check if booking can be cancelled
                if (booking.status === 'cancelled') {
                    results.push({
                        bookingId,
                        success: false,
                        error: 'Đặt sân đã được hủy trước đó'
                    });
                    continue;
                }

                // 🔍 DEBUG: Check for payment_pending protection in multiple cancellation
                console.log(`📋 Booking ${bookingId} status: ${booking.status}, payment_status: ${booking.payment_status}`);
                
                // Protect bookings that are pending payment (same as single cancellation)
                if (booking.status === 'payment_pending') {
                    console.log(`🛡️ MULTIPLE CANCELLATION: Protecting payment_pending booking ${bookingId}`);
                    results.push({
                        bookingId,
                        success: false,
                        error: 'Không thể hủy đặt sân đang chờ thanh toán để bảo trì'
                    });
                    continue;
                }

                // Process refund
                const needsStripeRefund = booking.status === 'confirmed' && 
                                         (booking.payment_status === 'paid' || booking.payment_status === 'completed') && 
                                         booking.total_price > 0;

                let refundAmount = 0;
                let stripeRefundId = null;

                if (needsStripeRefund) {
                    try {
                        // Find payment record
                        const payment = await Payment.findOne({
                            where: { booking_id: booking.id }
                        });

                        if (payment && payment.stripe_payment_intent_id) {
                            // Create refund via Stripe
                            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                            const refund = await stripe.refunds.create({
                                payment_intent: payment.stripe_payment_intent_id,
                                amount: Math.round(booking.total_price),
                                reason: 'requested_by_customer',
                                metadata: {
                                    booking_id: booking.id,
                                    cancellation_reason: `Bảo trì sân: ${maintenanceReason}`,
                                    user_id: booking.user_id,
                                    maintenance_cancellation: true
                                }
                            });

                            stripeRefundId = refund.id;
                            refundAmount = booking.total_price;

                            // Update payment record
                            await payment.update({
                                status: 'refunded',
                                refund_amount: refundAmount,
                                refund_reason: `Bảo trì sân: ${maintenanceReason}`,
                                stripe_refund_id: refund.id,
                                updated_at: new Date()
                            });
                        }
                    } catch (stripeError) {
                        console.error('❌ Stripe refund error for booking', bookingId, ':', stripeError);
                    }
                }

                // Update booking status
                await booking.update({
                    status: 'cancelled',
                    payment_status: needsStripeRefund ? 'refunded' : booking.payment_status,
                    cancellation_reason: `Bảo trì sân: ${maintenanceReason}`,
                    cancelled_at: new Date(),
                    cancelled_by: userId,
                    refund_amount: refundAmount,
                    stripe_refund_id: stripeRefundId
                });

                // Update TimeSlots status to maintenance
                if (booking.timeSlots && booking.timeSlots.length > 0) {
                    await Promise.all(booking.timeSlots.map(async (timeSlot) => {
                        await timeSlot.update({
                            status: 'maintenance',
                            maintenance_reason: maintenanceReason,
                            maintenance_until: null
                        });
                        
                        // Clear cache
                        const dbOptimizer = require('../utils/dbOptimizer');
                        await dbOptimizer.clearAvailabilityCache(timeSlot.sub_field_id, timeSlot.date);
                    }));
                }

                // Group booking info by customer email for summary email
                if (!customerEmails.has(user.email)) {
                    customerEmails.set(user.email, {
                        customerName: user.name,
                        bookings: [],
                        totalRefund: 0
                    });
                }

                const customerData = customerEmails.get(user.email);
                customerData.bookings.push({
                    bookingId: booking.id,
                    fieldName: booking.timeSlots && booking.timeSlots[0] && booking.timeSlots[0].subfield && booking.timeSlots[0].subfield.field 
                        ? booking.timeSlots[0].subfield.field.name : 'Sân bóng',
                    timeSlots: booking.timeSlots ? booking.timeSlots.map(ts => ({
                        subField: ts.subfield ? ts.subfield.name || 'N/A' : 'N/A',
                        startTime: ts.start_time,
                        endTime: ts.end_time,
                        date: ts.date
                    })) : [],
                    refundAmount: refundAmount,
                    totalPrice: booking.total_price,
                    bookingDate: booking.booking_date
                });
                customerData.totalRefund += refundAmount;

                totalRefundAmount += refundAmount;

                results.push({
                    bookingId,
                    success: true,
                    refundAmount,
                    customerEmail: user.email
                });

                console.log(`✅ Successfully processed booking ${bookingId} - refund: ${refundAmount}đ`);

            } catch (error) {
                console.error(`❌ Error processing booking ${bookingId}:`, error);
                results.push({
                    bookingId,
                    success: false,
                    error: error.message
                });
            }
        }

        // Send summary emails to each customer
        let emailsSent = 0;
        for (const [email, customerData] of customerEmails) {
            try {
                const emailService = require('../utils/emailService');
                
                // Format booking date
                const bookingDate = customerData.bookings[0]?.bookingDate;
                const vietnamTime = new Date(new Date(bookingDate).getTime() + (7 * 60 * 60 * 1000));
                const formattedDate = vietnamTime.toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'Asia/Ho_Chi_Minh'
                });

                // Combine all time slots from all bookings
                const allTimeSlots = customerData.bookings.flatMap(booking => booking.timeSlots);
                
                await emailService.sendMaintenanceCancellationEmail(
                    email,
                    customerData.customerName,
                    {
                        fieldName: customerData.bookings[0]?.fieldName || 'Sân bóng',
                        bookingDate: formattedDate,
                        timeSlots: allTimeSlots,
                        maintenanceReason: maintenanceReason,
                        refundAmount: customerData.totalRefund,
                        totalPrice: customerData.bookings.reduce((sum, b) => sum + b.totalPrice, 0),
                        willRefund: customerData.totalRefund > 0,
                        multipleBookings: customerData.bookings.length > 1,
                        bookingCount: customerData.bookings.length
                    }
                );
                emailsSent++;
                console.log(`✅ Summary email sent to ${email} for ${customerData.bookings.length} bookings`);
            } catch (emailError) {
                console.error(`❌ Error sending email to ${email}:`, emailError);
            }
        }

        // Emit socket events
        try {
            const { getSocketInstance } = require('../config/socket.config');
            const io = getSocketInstance();
            
            results.filter(r => r.success).forEach(result => {
                io.emit('booking_cancelled', {
                    bookingId: result.bookingId,
                    reason: `Bảo trì sân: ${maintenanceReason}`,
                    refundAmount: result.refundAmount,
                    maintenanceCancellation: true
                });
            });
            
            console.log('✅ Socket events emitted for maintenance cancellations');
        } catch (socketError) {
            console.error('❌ Socket error:', socketError);
        }

        const successfulCancellations = results.filter(r => r.success);
        const failedCancellations = results.filter(r => !r.success);

        performanceMonitor.endOperation(operationId, { success: true });
        return res.json(responseFormatter.success({
            totalProcessed: bookingIds.length,
            successful: successfulCancellations.length,
            failed: failedCancellations.length,
            totalRefundAmount,
            emailsSent,
            results,
            failedBookings: failedCancellations
        }, `Đã xử lý ${successfulCancellations.length}/${bookingIds.length} booking. Tổng hoàn tiền: ${totalRefundAmount.toLocaleString('vi-VN')}đ`));

    } catch (error) {
        console.error('❌ Error in cancelMultipleBookingsForMaintenance:', error);
        performanceMonitor.endOperation(operationId, { error: error.message });
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi hủy các đặt sân'
        }));
    }
};

module.exports = {
    getFieldAvailability,
    createBooking,
    getUserBookings,
    cancelBooking,
    getBookingById,
    getBookingStats,
    testEmail,
    processPayment,
    getFieldAvailabilityWithPricing,
    cancelBookingForMaintenance,
    cancelMultipleBookingsForMaintenance
};
