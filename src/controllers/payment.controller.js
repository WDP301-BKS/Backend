const PaymentService = require('../services/payment.service');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const { logEmailOperation } = require('../utils/logger');
const { Booking, TimeSlot, Field, User, SubField, Payment, Location } = require('../models');
const { ValidationError, Op } = require('sequelize');
const { sequelize } = require('../config/db.config');
const dbOptimizer = require('../utils/dbOptimizer');
const retryMechanism = require('../utils/retryMechanism');
const performanceMonitor = require('../utils/performanceMonitorNew');
const Redis = require('ioredis');
const sanitizeHtml = require('sanitize-html');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const { emitBookingStatusUpdate, emitBookingPaymentUpdate, emitBookingEvent } = require('../config/socket.config');
const { sendBookingConfirmationEmail, sendOwnerBookingNotificationEmail } = require('../utils/emailService');

// Redis setup with fallback
let redis = null;
let redisAvailable = false;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryDelay: 1000,
    showFriendlyErrorStack: false
  });
  
  redis.on('connect', () => {
    console.log('Redis connected successfully');
    redisAvailable = true;
  });
  
  redis.on('error', (err) => {
    console.warn('Redis unavailable, using in-memory locking for this session');
    redisAvailable = false;
    // Prevent reconnection attempts
    if (redis) {
      redis.disconnect();
      redis = null;
    }
  });
  
} catch (error) {
  console.warn('Redis initialization failed, using in-memory locking:', error.message);
  redisAvailable = false;
  redis = null;
}

// Simple in-memory lock for preventing concurrent duplicate bookings (fallback)
const bookingLocks = new Map();

// Rate limiter cho API thanh toán
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // giới hạn 5 request mỗi IP
  message: 'Quá nhiều yêu cầu thanh toán, vui lòng thử lại sau.'
});

class PaymentController {
  constructor() {
    // Constructor without rate limiter application
  }

  /**
   * Acquire lock using Redis or in-memory fallback
   */
  async acquireLock(lockKey, timeout = 30) {
    if (redisAvailable && redis) {
      try {
        return await redis.set(lockKey, 'locked', 'NX', 'EX', timeout);
      } catch (error) {
        console.warn('Redis lock failed, using in-memory fallback:', error.message);
        redisAvailable = false;
      }
    }
    
    // In-memory fallback
    if (bookingLocks.has(lockKey)) {
      return null; // Lock already exists
    }
    
    bookingLocks.set(lockKey, {
      timestamp: Date.now(),
      timeout: timeout * 1000 // Convert to milliseconds
    });
    
    // Clean up expired locks after timeout
    setTimeout(() => {
      this.releaseLock(lockKey);
    }, timeout * 1000);
    
    return 'OK';
  }

  /**
   * Release lock using Redis or in-memory fallback
   */
  async releaseLock(lockKey) {
    if (redisAvailable && redis) {
      try {
        await redis.del(lockKey);
        return;
      } catch (error) {
        console.warn('Redis unlock failed, using in-memory fallback:', error.message);
        redisAvailable = false;
      }
    }
    
    // In-memory fallback
    bookingLocks.delete(lockKey);
  }

  // Sanitize và validate đầu vào
  validateBookingData(data) {
    const fs = require('fs');
    try {
      fs.writeFileSync('/tmp/validation_debug.json', JSON.stringify({
        timestamp: new Date().toISOString(),
        receivedData: data
      }, null, 2));
      
      console.log('=== VALIDATION DEBUG ===');
      console.log('Received data:', JSON.stringify(data, null, 2));
      const errors = [];
    
    // Validate required fields
    if (!data.fieldId || !validator.isUUID(data.fieldId)) {
      errors.push('ID sân không hợp lệ');
    }
    
    if (!Array.isArray(data.subFieldIds) || data.subFieldIds.length === 0) {
      errors.push('Chưa chọn sân con');
    } else {
      // Validate each subfield ID
      for (const id of data.subFieldIds) {
        if (!validator.isUUID(id)) {
          errors.push('ID sân con không hợp lệ');
          break;
        }
      }
    }
    
    // Validate booking date
    if (!data.bookingDate || !validator.isDate(data.bookingDate)) {
      errors.push('Ngày đặt sân không hợp lệ');
    }
    
    // Validate time slots
    if (!Array.isArray(data.timeSlots) || data.timeSlots.length === 0) {
      errors.push('Chưa chọn khung giờ');
    } else {
      for (const slot of data.timeSlots) {
        if (!slot.start_time || !slot.end_time || 
            !validator.matches(slot.start_time, /^([01]\d|2[0-3]):([0-5]\d)$/) ||
            !validator.matches(slot.end_time, /^([01]\d|2[0-3]):([0-5]\d)$/)) {
          errors.push('Định dạng thời gian không hợp lệ');
          break;
        }
      }
    }
    
    // Validate amount
    if (!data.totalAmount || !validator.isInt(data.totalAmount.toString(), { min: 1000 })) {
      errors.push('Số tiền không hợp lệ');
    }
    
    // Validate customer info
    if (!data.customerInfo) {
      errors.push('Thiếu thông tin khách hàng');
    } else {
      if (!data.customerInfo.email || !validator.isEmail(data.customerInfo.email)) {
        errors.push('Email không hợp lệ');
      }
      if (!data.customerInfo.name || !validator.isLength(data.customerInfo.name, { min: 2, max: 100 })) {
        errors.push('Tên không hợp lệ');
      }
    }
    
    // Validate URLs - be more permissive for localhost URLs
    try {
      if (data.return_url) {
        const isValidReturnUrl = validator.isURL(data.return_url, { require_protocol: true, allow_localhost: true }) ||
                                  (data.return_url.startsWith('http://localhost:') || data.return_url.startsWith('https://localhost:'));
        fs.writeFileSync('/tmp/url_debug.json', JSON.stringify({
          return_url: data.return_url,
          isValidReturnUrl: isValidReturnUrl,
          cancel_url: data.cancel_url,
          isValidCancelUrl: data.cancel_url ? (validator.isURL(data.cancel_url, { require_protocol: true, allow_localhost: true }) ||
                                              (data.cancel_url.startsWith('http://localhost:') || data.cancel_url.startsWith('https://localhost:'))) : 'not provided'
        }, null, 2));
        
        if (!isValidReturnUrl) {
          errors.push('URL trả về không hợp lệ');
        }
      }
      if (data.cancel_url) {
        const isValidCancelUrl = validator.isURL(data.cancel_url, { require_protocol: true, allow_localhost: true }) ||
                                  (data.cancel_url.startsWith('http://localhost:') || data.cancel_url.startsWith('https://localhost:'));
        if (!isValidCancelUrl) {
          errors.push('URL hủy không hợp lệ');
        }
      }
    } catch (urlError) {
      console.error('URL validation error:', urlError);
      fs.writeFileSync('/tmp/url_validation_error.json', JSON.stringify({
        error: urlError.message,
        stack: urlError.stack
      }, null, 2));
      errors.push('Lỗi xác thực URL');
    }

    console.log('=== VALIDATION RESULT ===');
    console.log('Errors found:', errors);
    console.log('Number of errors:', errors.length);
    
    fs.writeFileSync('/tmp/validation_result.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      errors: errors,
      errorCount: errors.length
    }, null, 2));
    
    return errors;
    } catch (mainError) {
      console.error('Main validation error:', mainError);
      fs.writeFileSync('/tmp/validation_main_error.json', JSON.stringify({
        error: mainError.message,
        stack: mainError.stack
      }, null, 2));
      return ['Lỗi xác thực dữ liệu'];
    }
  }

  // Sanitize customer info
  sanitizeCustomerInfo(customerInfo) {
    return {
      name: sanitizeHtml(customerInfo.name),
      email: sanitizeHtml(customerInfo.email),
      notes: customerInfo.notes ? sanitizeHtml(customerInfo.notes) : ''
    };
  }

  /**
   * Create booking and payment intent together
   */
  async createBookingWithPayment(req, res) {
    console.log('createBookingWithPayment method called');
    logger.info('createBookingWithPayment method called');
    
    const operationId = performanceMonitor.startOperation('create_booking_with_payment', {
      type: 'payment_booking',
      fieldId: req.body.fieldId,
      amount: req.body.totalAmount
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
      
      // Validate input data
      const validationErrors = this.validateBookingData(req.body);
      if (validationErrors.length > 0) {
        logger.error('Booking validation errors:', validationErrors);
        console.error('Booking validation errors:', validationErrors);
        return res.status(400).json(responseFormatter.error({ 
          code: 400, 
          message: 'Dữ liệu không hợp lệ',
          errors: validationErrors
        }));
      }
      
      const {
        fieldId,
        subFieldIds,
        bookingDate,
        timeSlots,
        totalAmount,
        customerInfo,
        currency = 'vnd',
        return_url
      } = req.body;

      // Sanitize customer info
      const sanitizedCustomerInfo = this.sanitizeCustomerInfo(customerInfo);
      
      // Create a unique lock key
      const lockKey = `booking:${fieldId}:${bookingDate}:${sanitizedCustomerInfo.email}:${totalAmount}`;
      
      // Try to acquire lock with 30s timeout
      const locked = await this.acquireLock(lockKey, 30);
      if (!locked) {
        console.log('Request already being processed, rejecting duplicate:', lockKey);
        return res.status(409).json(responseFormatter.error({ 
          code: 409, 
          message: 'Booking request already in progress' 
        }));
      }

      try {
        console.log('Validation passed, checking field:', fieldId);
        
        // Check if field exists with retry mechanism and fetch full info for metadata
        const field = await retryMechanism.executeDatabaseOperation(
          () => Field.findByPk(fieldId, {
            include: [
              {
                model: Location,
                as: 'location',
                attributes: ['address_text', 'city', 'district', 'ward']
              }
            ],
            attributes: ['id', 'name', 'description', 'price_per_hour', 'images1']
          }),
          'field_lookup'
        );
        
        console.log('Field found:', !!field);
        if (!field) {
          console.log('Field not found in database');
          performanceMonitor.endOperation(operationId, { error: 'FIELD_NOT_FOUND' });
          return res.status(404).json(responseFormatter.error({ 
            code: 404, 
            message: 'Field not found' 
          }));
        }

        // Fetch subfield info for metadata
        let subFieldsInfo = [];
        if (subFieldIds && subFieldIds.length > 0) {
          try {
            const subFields = await retryMechanism.executeDatabaseOperation(
              () => SubField.findAll({
                where: { id: subFieldIds },
                attributes: ['id', 'name', 'field_type']
              }),
              'subfield_lookup'
            );
            subFieldsInfo = subFields;
          } catch (subFieldError) {
            console.log('Could not fetch subfield info:', subFieldError.message);
          }
        }

        // Use optimized availability check with proper overlap logic
        console.log('Checking availability with optimized method (fixed overlap logic)');
        const availabilityResult = await retryMechanism.executeDatabaseOperation(
          () => dbOptimizer.checkAvailabilityOptimized(fieldId, bookingDate, timeSlots),
          'availability_check'
        );

        if (!availabilityResult.isAvailable) {
          console.log('❌ Found conflicts:', availabilityResult.conflicts);
          performanceMonitor.endOperation(operationId, { error: 'AVAILABILITY_CONFLICT' });
          const firstConflict = availabilityResult.conflicts[0];
          const errorMessage = `Time slot ${firstConflict.requestedSlot?.start_time || 'không xác định'} is already booked`;
          console.log('Returning error:', errorMessage);
          
          const errorResponse = responseFormatter.error({ 
            code: 409, 
            message: errorMessage, 
            details: { conflicts: availabilityResult.conflicts } 
          });
          console.log('Generated error response:', JSON.stringify(errorResponse, null, 2));
          
          return res.status(409).json(errorResponse);
        }
        
        console.log('✅ All time slots are available');

        // Additional check: look for recent duplicate bookings with optimized lookup
        const recentBooking = await retryMechanism.executeDatabaseOperation(
          () => dbOptimizer.findRecentDuplicateBooking(fieldId, bookingDate, sanitizedCustomerInfo.email, totalAmount, 30000),
          'duplicate_check'
        );

        if (recentBooking) {
          console.log('Duplicate booking attempt detected, returning existing booking:', recentBooking.id);
          
          // Find existing payment for this booking with retry
          const existingPayment = await retryMechanism.executeDatabaseOperation(
            () => Payment.findOne({ where: { booking_id: recentBooking.id } }),
            'payment_lookup'
          );

          if (existingPayment) {
            performanceMonitor.endOperation(operationId, { success: true, duplicate: true });
            return res.status(200).json(responseFormatter.success({
              booking_id: recentBooking.id,
              payment_intent_id: existingPayment.stripe_payment_intent_id,
              client_secret: existingPayment.stripe_client_secret,
              payment_id: existingPayment.id,
              amount: existingPayment.amount,
              currency: existingPayment.currency || 'vnd'
            }, 'Existing booking and payment found'));
          }
        }

        // Create booking with pending status using transaction with retry mechanism
        console.log('Creating booking...');
        let booking;
        let attemptCount = 0;
        const maxRetries = 3;
        
        while (attemptCount < maxRetries) {
          try {
            attemptCount++;
            console.log(`🔄 Atomic booking creation attempt ${attemptCount}/${maxRetries}`);
            
            // Use atomic booking creation with proper conflict detection
            const atomicResult = await retryMechanism.executeDatabaseOperation(
              () => dbOptimizer.createBookingAtomically(fieldId, bookingDate, timeSlots, {
                user_id: userId,
                booking_date: new Date(),
                status: 'payment_pending', // Start with payment_pending
                total_price: totalAmount,
                payment_status: 'pending',
                customer_info: sanitizedCustomerInfo,
                booking_metadata: {
                  fieldId,
                  fieldName: field.name,
                  fieldDescription: field.description,
                  fieldImages: field.images1,
                  fieldLocation: field.location ? {
                    address: field.location.address_text,
                    city: field.location.city,
                    district: field.location.district,
                    ward: field.location.ward
                  } : null,
                  subFieldIds,
                  subFields: subFieldsInfo.map(sf => ({
                    id: sf.id,
                    name: sf.name,
                    field_type: sf.field_type
                  })),
                  playDate: bookingDate,
                  timeSlots
                }
              }),
              'atomic_booking_creation'
            );

            // Check if booking creation failed due to conflicts
            if (atomicResult.error) {
              console.log('❌ Booking creation failed due to conflicts:', atomicResult.message);
              performanceMonitor.endOperation(operationId, { error: atomicResult.code });
              return res.status(409).json(responseFormatter.error({
                code: atomicResult.code,
                message: atomicResult.message,
                details: atomicResult.details
              }));
            }

            booking = atomicResult;
            console.log('✅ Booking and time slots created atomically:', booking.id);
            
            // Monitor payment operation
            performanceMonitor.monitorPaymentOperation('create', booking.id, totalAmount, true);
            
            // Break out of retry loop on success
            break;

          } catch (transactionError) {
            console.error(`❌ Transaction error on attempt ${attemptCount}:`, transactionError);
            
            // Check if it's a deadlock or lock timeout that we can retry
            const isRetryableError = (
              transactionError.original?.code === '40P01' || // PostgreSQL deadlock
              transactionError.original?.errno === 1213 ||   // MySQL deadlock
              transactionError.original?.code === '55P03' || // PostgreSQL lock timeout
              transactionError.original?.errno === 1205 ||   // MySQL lock timeout
              transactionError.message.includes('deadlock') ||
              transactionError.message.includes('timeout') ||
              transactionError.message.includes('SERIALIZABLE')
            );
            
            if (isRetryableError && attemptCount < maxRetries) {
              console.log(`🔄 Detected retryable error, waiting before retry ${attemptCount + 1}...`);
              // Wait with exponential backoff before retry
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attemptCount) * 100));
              continue; // Retry
            }
            
            // Check if it's a unique constraint violation (race condition caught by DB)
            if (transactionError.name === 'SequelizeUniqueConstraintError' || 
                transactionError.original?.code === '23505' || // PostgreSQL unique violation
                transactionError.original?.errno === 1062 ||   // MySQL duplicate entry
                transactionError.message.includes('duplicate') || 
                transactionError.message.includes('unique')) {
              
              console.log('🚨 Race condition caught by database constraint');
              performanceMonitor.endOperation(operationId, { error: 'RACE_CONDITION_DB' });
              return res.status(409).json(responseFormatter.error({
                code: 409,
                message: 'Khung giờ đã được đặt bởi người dùng khác cùng lúc',
                details: { error: 'Database prevented race condition' }
              }));
            }
            
            // If we've exhausted retries or hit a non-retryable error
            if (attemptCount >= maxRetries) {
              console.log('❌ Max retries exhausted, failing request');
              performanceMonitor.monitorPaymentOperation('create', null, totalAmount, false, transactionError.message);
              throw transactionError;
            }
          }
        }

        // Create Stripe Checkout Session after successful transaction
        console.log('Creating Stripe Checkout Session...');
        try {
          const paymentData = {
            booking_id: booking.id,
            amount: parseInt(totalAmount),
            currency,
            customer_info: sanitizedCustomerInfo,
            field: field,
            booking_metadata: {
              fieldId,
              subFieldIds,
              playDate: bookingDate,
              timeSlots
            },
            success_url: `${req.headers.origin || 'http://localhost:5173'}/booking/confirmation?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin || 'http://localhost:5173'}/payment/cancel`
          };

          const paymentResult = await PaymentService.createCheckoutSession(paymentData);
          console.log('Checkout session created:', paymentResult.session_id);

          return res.status(200).json(responseFormatter.success({
            booking_id: booking.id,
            checkout_url: paymentResult.checkout_url,
            session_id: paymentResult.session_id,
            payment_id: paymentResult.payment_id,
            amount: paymentResult.amount,
            currency: paymentResult.currency
          }, 'Booking and checkout session created successfully'));

        } catch (paymentError) {
          console.error('Error creating checkout session:', paymentError);
          throw paymentError;
        }

      } catch (error) {
        logger.error('Error creating booking with payment:', error);
        if (error instanceof ValidationError) {
          return res.status(400).json(responseFormatter.error({ 
            code: 400, 
            message: 'Validation error: ' + error.message 
          }));
        }
        return res.status(500).json(responseFormatter.error({ 
          code: 500, 
          message: error.message 
        }));
      } finally {
        // Always release the lock
        await this.releaseLock(lockKey);
      }
    } catch (error) {
      logger.error('Error in createBookingWithPayment:', error);
      return res.status(500).json(responseFormatter.error({ 
        code: 500, 
        message: 'Internal server error' 
      }));
    }
  }

  /**
   * Create payment intent for existing booking
   */
  async createPaymentIntent(req, res) {
    try {
      const { 
        booking_id, 
        amount, 
        currency = 'vnd',
        return_url,
        customer_info 
      } = req.body;

      // Validate required fields
      if (!booking_id || !amount) {
        return res.status(400).json(responseFormatter.error({ 
          code: 400, 
          message: 'Booking ID và số tiền là bắt buộc' 
        }));
      }

      const paymentData = {
        booking_id,
        user_id: req.user?.id || null,
        amount: parseInt(amount),
        currency,
        customer_info,
        metadata: {
          return_url,
          source: 'web_booking'
        }
      };

      const result = await PaymentService.createPaymentIntent(paymentData);

      return res.status(200).json(responseFormatter.success({
        payment_intent_id: result.payment_intent_id,
        client_secret: result.client_secret,
        payment_id: result.payment_id,
        amount: result.amount,
        currency: result.currency
      }, 'Payment intent created successfully'));

    } catch (error) {
      logger.error('Error creating payment intent:', error);
      return res.status(500).json(responseFormatter.error({ 
        code: 500, 
        message: error.message 
      }));
    }
  }

  /**
   * Confirm payment
   */
  async confirmPayment(req, res) {
    try {
      const { payment_intent_id } = req.body;

      if (!payment_intent_id) {
        return res.status(400).json(responseFormatter.error({ 
          code: 400, 
          message: 'Payment intent ID is required' 
        }));
      }

      const result = await PaymentService.confirmPayment(payment_intent_id);

      return res.status(200).json(responseFormatter.success(result, 'Payment confirmed successfully'));

    } catch (error) {
      logger.error('Error confirming payment:', error);
      return res.status(500).json(responseFormatter.error({ 
        code: 500, 
        message: error.message 
      }));
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(req, res) {
    try {
      const { payment_id } = req.params;

      const payment = await PaymentService.getPaymentDetails(payment_id);

      if (!payment) {
        return res.status(404).json(responseFormatter.error({ 
          code: 404, 
          message: 'Payment not found' 
        }));
      }

      return res.status(200).json(responseFormatter.success(payment, 'Payment details retrieved successfully'));

    } catch (error) {
      logger.error('Error getting payment details:', error);
      return res.status(500).json(responseFormatter.error({ 
        code: 500, 
        message: error.message 
      }));
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
      // Construct event from raw body
      event = require('stripe')(process.env.STRIPE_SECRET_KEY).webhooks.constructEvent(
        req.body, 
        sig, 
        endpointSecret
      );
      
      logger.info('Stripe webhook event received:', { type: event.type, id: event.id });
      
    } catch (err) {
      logger.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    try {
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed':
          logger.info('Processing checkout.session.completed webhook');
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
          
        case 'checkout.session.async_payment_succeeded':
          logger.info('Processing checkout.session.async_payment_succeeded webhook');
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
          
        case 'checkout.session.expired':
          logger.info('Processing checkout.session.expired webhook');
          await this.handleCheckoutSessionExpired(event.data.object);
          break;
          
        case 'payment_intent.succeeded':
          logger.info('Processing payment_intent.succeeded webhook');
          await this.handlePaymentSucceeded(event.data.object);
          break;
          
        case 'payment_intent.payment_failed':
          logger.info('Processing payment_intent.payment_failed webhook');
          await this.handlePaymentFailed(event.data.object);
          break;
          
        case 'checkout.session.pending':
          logger.info('Processing checkout.session.pending webhook');
          await this.handleCheckoutSessionPending(event.data.object);
          break;
          
        default:
          logger.info('Unhandled event type:', event.type);
      }
      
      // Return a 200 response to acknowledge receipt of the event
      res.status(200).json({ received: true });
      
    } catch (error) {
      logger.error('Error handling webhook:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }

  /**
   * Handle successful checkout session (booking or package)
   */
  async handleCheckoutSessionCompleted(session) {
    try {
      logger.info('Processing completed checkout session:', session.id);
      logger.info('Session details:', {
        id: session.id,
        payment_intent: session.payment_intent,
        payment_status: session.payment_status,
        client_reference_id: session.client_reference_id,
        metadata: session.metadata
      });
      
      // CRITICAL FIX: Only process if payment is actually completed
      if (session.payment_status !== 'paid') {
        logger.info(`Session ${session.id} completed but payment not yet paid (status: ${session.payment_status}). Handling as pending.`);
        await this.handleCheckoutSessionPending(session);
        return;
      }
      
      // Xác định loại giao dịch từ metadata hoặc client_reference_id
      // Giả định: metadata.type = 'booking' | 'package', metadata.userId, metadata.packageType
      const type = session.metadata?.type || 'booking';
      
      // Use transaction to ensure data consistency
      const transaction = await sequelize.transaction();

      try {
        if (type === 'package') {
          // Thanh toán mua package
          const userId = session.metadata?.userId;
          const packageType = session.metadata?.packageType;
          if (!userId || !packageType) {
            logger.error('Missing userId or packageType in session metadata for package payment');
            await transaction.rollback();
            return;
          }
          const user = await User.findByPk(userId, { transaction });
          if (!user) {
            logger.error('User not found for package payment:', userId);
            await transaction.rollback();
            return;
          }
          
          // Tính toán ngày hết hạn mới
          let newExpireDate;
          const today = new Date();
          
          // Nếu người dùng đã có gói và chưa hết hạn (gia hạn sớm)
          if (user.package_expire_date && new Date(user.package_expire_date) > today) {
            // Cộng dồn thời gian vào ngày hết hạn hiện tại
            newExpireDate = new Date(user.package_expire_date);
          } else {
            // Tính từ ngày hiện tại nếu chưa có gói hoặc đã hết hạn
            newExpireDate = new Date();
          }
          
          // Thêm thời gian của gói mới
          const months = packageType === 'premium' ? 6 : 1;
          newExpireDate.setMonth(newExpireDate.getMonth() + months);
          
          // Cập nhật thông tin package cho user
          await user.update({
            package_type: packageType,
            package_purchase_date: new Date(),
            package_expire_date: newExpireDate
          }, { transaction });
          logger.info('User package updated successfully:', userId);
          await transaction.commit();
          // TODO: Gửi thông báo, email, v.v. cho user về việc mua package thành công
        } else {
          // Handle booking payment
          // Find the booking using client_reference_id
          const booking = await Booking.findByPk(session.client_reference_id, { transaction });
          if (!booking) {
            logger.error('Booking not found for session:', session.id);
            await transaction.rollback();
            return;
          }
          
          logger.info('Found booking:', {
            id: booking.id,
            status: booking.status,
            payment_status: booking.payment_status
          });
          
          // Check if booking is already confirmed (to avoid duplicate processing)
          const wasAlreadyConfirmed = booking.status === 'confirmed' && booking.payment_status === 'paid';
          
          // Update booking status (idempotent operation)
          await booking.update({
            status: 'confirmed',
            payment_status: 'paid'
          }, { transaction });
          
          logger.info('Booking updated successfully to confirmed status');
          
          // Update payment record với thông tin đầy đủ từ session
          const updateData = {
            status: 'succeeded',
            stripe_payment_intent_id: session.payment_intent,
            stripe_session_id: session.id,
            stripe_status: 'paid',
            processed_at: new Date(),
            updated_at: new Date()
          };

          // Lấy thêm thông tin từ session metadata nếu có
          if (session.metadata) {
            if (session.metadata.customer_email && !updateData.customer_email) {
              updateData.customer_email = session.metadata.customer_email;
            }
            if (session.metadata.customer_name && !updateData.customer_name) {
              updateData.customer_name = session.metadata.customer_name;
            }
          }

          // Nếu session có customer_details, ưu tiên sử dụng
          if (session.customer_details?.email) {
            updateData.customer_email = session.customer_details.email;
          }
          if (session.customer_details?.name) {
            updateData.customer_name = session.customer_details.name;
          }

          const updateResult = await Payment.update(
            updateData,
            {
              where: { booking_id: booking.id },
              transaction
            }
          );
          
          logger.info(`Payment record updated: ${updateResult[0]} row(s) affected`);
          logger.info('✅ Payment confirmed - booking status updated to confirmed');
          
          // Time slots should already exist from atomic booking creation
          // Just update them to confirmed status if payment successful
          if (!wasAlreadyConfirmed) {
            const existingTimeSlots = await TimeSlot.findAll({
              where: {
                booking_id: booking.id
              },
              transaction
            });

            if (existingTimeSlots.length > 0) {
              // Time slots already exist, just ensure they're properly marked as unavailable
              await TimeSlot.update(
                { status: 'booked' },
                {
                  where: { booking_id: booking.id },
                  transaction
                }
              );
              logger.info(`Confirmed ${existingTimeSlots.length} existing time slots for booking:`, booking.id);
            } else {
              logger.warn('No time slots found for booking - this should not happen with atomic creation');
            }
          } else {
            logger.info('Booking was already confirmed, time slots already exist');
          }
          
          await transaction.commit();
          logger.info('Booking confirmed successfully:', booking.id);
          
          // Emit real-time updates via WebSocket
          try {
            emitBookingStatusUpdate(booking.id, {
              status: 'confirmed',
              payment_status: 'paid',
              userId: booking.user_id,
              message: 'Payment successful - Booking confirmed!'
            });
            
            // Emit booking payment update với thông tin chi tiết hơn
            emitBookingPaymentUpdate(booking.id, {
              payment_status: 'paid',
              status: 'succeeded',
              userId: booking.user_id,
              bookingId: booking.id,
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent,
              amount: booking.total_price,
              currency: 'vnd',
              timestamp: new Date().toISOString(),
              message: 'Payment processed successfully'
            });
            
            // Emit general booking event for broader notifications với flag refresh
            emitBookingEvent('payment_confirmed', booking.id, {
              userId: booking.user_id,
              bookingId: booking.id,
              status: 'confirmed',
              payment_status: 'paid',
              amount: booking.total_price,
              timestamp: new Date().toISOString(),
              refresh_needed: true, // Flag để frontend biết cần refresh booking history
              message: 'Your booking has been confirmed and payment processed successfully!'
            });
            
            logger.info('Real-time notifications sent for booking confirmation:', booking.id);
            
          } catch (socketError) {
            // Log socket errors but don't fail the webhook
            logger.error('Error sending real-time notifications (webhook still succeeded):', socketError);
          }
          
          // Send confirmation emails
          try {
            // Get booking details with related data for email
          const bookingWithDetails = await Booking.findByPk(booking.id, {
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
              },
              {
                model: TimeSlot,
                as: 'timeSlots',
                attributes: ['id', 'start_time', 'end_time', 'date', 'sub_field_id'],
                include: [
                  {
                    model: SubField,
                    as: 'subfield',
                    attributes: ['id', 'name', 'field_id'],
                    include: [
                      {
                        model: Field,
                        as: 'field',
                        attributes: ['id', 'name', 'owner_id'],
                        include: [
                          {
                            model: User,
                            as: 'owner',
                            attributes: ['id', 'name', 'email']
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          });

          if (bookingWithDetails && bookingWithDetails.user && bookingWithDetails.timeSlots && bookingWithDetails.timeSlots.length > 0) {
            const firstTimeSlot = bookingWithDetails.timeSlots[0];
            const field = firstTimeSlot.subfield?.field;
            
            if (field) {
              // Prepare booking details for email
              const timeSlots = bookingWithDetails.timeSlots || [];
              let startTime = '';
              let endTime = '';
              
              // Create time ranges from start_time and end_time
              const formatTime = (timeStr) => {
                if (!timeStr) return '';
                // timeStr is in format "HH:MM:SS", we want "HH:MM"
                return timeStr.substring(0, 5);
              };
              
              // Try to get time from TimeSlots first
              if (timeSlots.length > 0) {
                const firstSlot = timeSlots[0];
                const lastSlot = timeSlots[timeSlots.length - 1];
                startTime = firstSlot ? formatTime(firstSlot.start_time) : '';
                endTime = lastSlot ? formatTime(lastSlot.end_time) : '';
              }
              
              // Fallback to booking metadata if TimeSlots don't have proper data
              if (!startTime || !endTime) {
                const metadataTimeSlots = bookingWithDetails.booking_metadata?.timeSlots || [];
                if (metadataTimeSlots.length > 0) {
                  const firstMetaSlot = metadataTimeSlots[0];
                  const lastMetaSlot = metadataTimeSlots[metadataTimeSlots.length - 1];
                  startTime = firstMetaSlot?.start_time || startTime;
                  endTime = lastMetaSlot?.end_time || endTime;
                }
              }
              
              const bookingDetails = {
                fieldName: field.name,
                customerName: bookingWithDetails.customer_info?.name || bookingWithDetails.user.name,
                customerEmail: bookingWithDetails.customer_info?.email || bookingWithDetails.user.email,
                customerPhone: bookingWithDetails.customer_info?.phone || 'Không có thông tin',
                date: new Date(bookingWithDetails.booking_date).toLocaleDateString('vi-VN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                startTime: startTime,
                endTime: endTime,
                timeRange: `${startTime} - ${endTime}`,
                totalAmount: bookingWithDetails.total_price,
                bookingId: bookingWithDetails.id
              };

              // Send confirmation email to customer
              if (bookingDetails.customerEmail) {
                try {
                  logger.info('Sending confirmation email with details:', {
                    customerEmail: bookingDetails.customerEmail,
                    timeRange: bookingDetails.timeRange,
                    startTime: startTime,
                    endTime: endTime,
                    source: 'handleCheckoutSessionCompleted'
                  });
                  
                  await sendBookingConfirmationEmail(
                    bookingDetails.customerEmail,
                    bookingDetails.customerName,
                    bookingDetails
                  );
                  logEmailOperation('send', bookingDetails.customerEmail, 'booking_confirmation', true);
                  logger.info('Confirmation email sent to customer:', bookingDetails.customerEmail);
                } catch (emailError) {
                  logEmailOperation('send', bookingDetails.customerEmail, 'booking_confirmation', false, emailError);
                  logger.error('Failed to send confirmation email to customer:', emailError);
                }
              }

              // Send notification email to field owner
              if (field.owner && field.owner.email) {
                try {
                  await sendOwnerBookingNotificationEmail(
                    field.owner.email,
                    field.owner.name,
                    bookingDetails
                  );
                  logEmailOperation('send', field.owner.email, 'owner_notification', true);
                  logger.info('Notification email sent to field owner:', field.owner.email);
                } catch (emailError) {
                  logEmailOperation('send', field.owner.email, 'owner_notification', false, emailError);
                  logger.error('Failed to send notification email to field owner:', emailError);
                }
              }
            }
          }
        } catch (emailError) {
          // Log email errors but don't fail the webhook
          logger.error('Error sending confirmation emails (webhook still succeeded):', emailError);
        }
        }
        
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
    } catch (error) {
      logger.error('Error handling checkout session completed:', error);
      throw error;
    }
  }

  /**
   * Handle expired checkout session
   */
  async handleCheckoutSessionExpired(session) {
    try {
      logger.info('Processing expired checkout session:', session.id);
      
      // Use transaction to ensure data consistency
      const transaction = await sequelize.transaction();
      
      try {
        const booking = await Booking.findByPk(session.client_reference_id, { transaction });
        if (!booking) {
          logger.error('Booking not found for expired session:', session.id);
          await transaction.rollback();
          return;
        }
        
        // Update booking status to cancelled
        await booking.update({
          status: 'cancelled',
          payment_status: 'failed'
        }, { transaction });
        
        // Update payment record
        await Payment.update(
          {
            payment_status: 'failed',
            stripe_session_id: session.id,
            updated_at: new Date()
          },
          {
            where: { booking_id: booking.id },
            transaction
          }
        );
        
        // Free up the reserved time slots since payment failed
        const deletedCount = await TimeSlot.destroy({
          where: { booking_id: booking.id },
          transaction
        });
        
        if (deletedCount > 0) {
          logger.info(`Freed up ${deletedCount} reserved time slots for expired booking:`, booking.id);
        } else {
          logger.info('No time slots to free up for expired booking:', booking.id);
        }
        
        await transaction.commit();
        logger.info('Booking cancelled due to expired session:', booking.id);
        
        // Emit real-time updates via WebSocket
        try {
          // Emit booking status update
          emitBookingStatusUpdate(booking.id, {
            status: 'cancelled',
            payment_status: 'failed',
            userId: booking.user_id,
            message: 'Payment session expired - Booking cancelled'
          });
          
          // Emit booking payment update
          emitBookingPaymentUpdate(booking.id, {
            payment_status: 'failed',
            status: 'expired',
            userId: booking.user_id,
            stripe_session_id: session.id,
            message: 'Payment session expired'
          });
          
          // Emit general booking event
          emitBookingEvent('payment_expired', booking.id, {
            userId: booking.user_id,
            status: 'cancelled',
            payment_status: 'failed',
            message: 'Your payment session has expired. Please try booking again.'
          });
          
          logger.info('Real-time notifications sent for booking cancellation:', booking.id);
          
        } catch (socketError) {
          // Log socket errors but don't fail the webhook
          logger.error('Error sending real-time notifications (webhook still succeeded):', socketError);
        }
        
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
      
    } catch (error) {
      logger.error('Error handling checkout session expired:', error);
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSucceeded(paymentIntent) {
    try {
      logger.info('Processing successful payment intent:', paymentIntent.id);
      
      // Use PaymentService to handle the payment
      await PaymentService.handlePaymentSucceeded(paymentIntent);
      logger.info('Payment intent processed successfully via PaymentService');
      
    } catch (error) {
      logger.error('Error handling payment succeeded:', error);
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailed(paymentIntent) {
    try {
      logger.info('Processing failed payment intent:', paymentIntent.id);
      
      // Use PaymentService to handle the payment failure
      await PaymentService.handlePaymentFailed(paymentIntent);
      logger.info('Payment failure processed successfully via PaymentService');
      
    } catch (error) {
      logger.error('Error handling payment failed:', error);
    }
  }

  /**
   * Handle checkout session created/completed but payment pending
   */
  async handleCheckoutSessionPending(session) {
    try {
      logger.info('Processing checkout session with pending payment:', session.id);
      
      // Update payment record to show session is active but payment pending
      const updateResult = await Payment.update(
        {
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          updated_at: new Date()
        },
        {
          where: { 
            booking_id: session.client_reference_id 
          }
        }
      );
      
      logger.info(`Payment record updated with session info: ${updateResult[0]} row(s) affected`);
      
      // Emit real-time update that session is ready for payment
      const booking = await Booking.findByPk(session.client_reference_id);
      if (booking) {
        emitBookingStatusUpdate(booking.id, {
          status: 'payment_pending',
          payment_status: 'pending',
          userId: booking.user_id,
          message: 'Checkout session ready - awaiting payment completion'
        });
      }
      
    } catch (error) {
      logger.error('Error handling checkout session pending:', error);
    }
  }

  /**
   * Get payment methods (for frontend)
   */
  async getPaymentMethods(req, res) {
    try {
      const paymentMethods = [
        {
          id: 'card',
          name: 'Thẻ tín dụng/ghi nợ',
          type: 'card',
          supported_currencies: ['vnd', 'usd'],
          icon: 'credit-card'
        },
        {
          id: 'momo',
          name: 'Ví MoMo',
          type: 'wallet',
          supported_currencies: ['vnd'],
          icon: 'wallet'
        }
      ];

      return res.status(200).json(responseFormatter.success(paymentMethods, 'Payment methods retrieved successfully'));

    } catch (error) {
      logger.error('Error getting payment methods:', error);
      return res.status(500).json(responseFormatter.error({ 
        code: 500, 
        message: error.message 
      }));
    }
  }

  /**
   * Get booking details by booking ID
   */
  async getBookingById(req, res) {
    try {
      const { bookingId } = req.params;
      
      if (!bookingId) {
        return res.status(400).json(responseFormatter.error({
          code: 400,
          message: 'Booking ID is required'
        }));
      }
      
      // Use the helper method to get booking details
      const formattedBookingData = await this.getBookingDetails(bookingId);
      
      if (!formattedBookingData) {
        return res.status(404).json(responseFormatter.error({
          code: 404,
          message: 'Booking or field not found'
        }));
      }
      
      // Return formatted data
      return res.status(200).json(responseFormatter.success({
        message: 'Booking details retrieved successfully',
        data: formattedBookingData
      }));
      
    } catch (error) {
      console.error('Error fetching booking by ID:', error);
      console.error('Error details:', error.message);
      logger.error('Error fetching booking by ID:', error);
      return res.status(500).json(responseFormatter.error({
        code: 500,
        message: 'Failed to get booking details'
      }));
    }
  }

  /**
   * Get booking details by session ID
   */
  async getBookingBySessionId(req, res) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json(responseFormatter.error({
          code: 400,
          message: 'Session ID is required'
        }));
      }
      
      // Find payment by session ID
      const payment = await Payment.findOne({
        where: { stripe_session_id: sessionId },
        include: [{
          model: Booking,
          as: 'booking',
          include: [
            {
              model: TimeSlot,
              as: 'timeSlots'
            }
          ]
        }]
      });
      
      if (!payment || !payment.booking) {
        return res.status(404).json(responseFormatter.error({
          code: 404,
          message: 'Booking not found'
        }));
      }
      
      const booking = payment.booking;
      const field = await Field.findByPk(booking.booking_metadata.fieldId);
      
      const bookingDetails = {
        id: booking.id,
        bookingDate: booking.booking_date,
        field: {
          id: field?.id || booking.booking_metadata.fieldId,
          name: field?.name || 'Unknown Field',
          description: field?.description || '',
          price_per_hour: field?.price_per_hour || 0,
          images1: field?.images1 || '',
          location: {
            address_text: field?.address_text || '',
            city: field?.city || '',
            district: field?.district || '',
            ward: field?.ward || ''
          },
          owner: {
            id: field?.owner_id || '',
            name: field?.owner_name || ''
          },
          subfields: []
        },
        timeSlots: booking.timeSlots?.map(slot => ({
          startTime: slot.start_time,
          endTime: slot.end_time,
          sub_field_id: slot.sub_field_id
        })) || [],
        totalAmount: booking.total_price,
        currency: payment.currency || 'vnd',
        status: booking.status,
        paymentStatus: booking.payment_status,
        customerInfo: booking.customer_info,
        createdAt: booking.created_at
      };
      
      return res.status(200).json(responseFormatter.success({
        message: 'Booking details retrieved successfully',
        data: bookingDetails
      }));
      
    } catch (error) {
      logger.error('Error getting booking by session ID:', error);
      return res.status(500).json(responseFormatter.error({
        code: 500,
        message: 'Failed to get booking details'
      }));
    }
  }

  /**
   * Create refund
   */
  async createRefund(req, res) {
    try {
      const { payment_id } = req.params;
      const { amount, reason } = req.body;
      
      if (!payment_id) {
        return res.status(400).json(responseFormatter.error({
          code: 400,
          message: 'Payment ID is required'
        }));
      }
      
      if (!amount || amount <= 0) {
        return res.status(400).json(responseFormatter.error({
          code: 400,
          message: 'Valid refund amount is required'
        }));
      }
      
      // Find payment record
      const payment = await Payment.findByPk(payment_id, {
        include: [{ model: Booking, as: 'booking' }]
      });
      
      if (!payment) {
        return res.status(404).json(responseFormatter.error({
          code: 404,
          message: 'Payment not found'
        }));
      }
      
      if (payment.status !== 'succeeded') {
        return res.status(400).json(responseFormatter.error({
          code: 400,
          message: 'Can only refund successful payments'
        }));
      }
      
      // Use PaymentService to create refund
      const refundResult = await PaymentService.createRefund(payment_id, amount, reason);
      
      return res.status(200).json(responseFormatter.success({
        message: 'Refund created successfully',
        data: refundResult
      }));
      
    } catch (error) {
      logger.error('Error creating refund:', error);
      return res.status(500).json(responseFormatter.error({
        code: 500,
        message: error.message || 'Failed to create refund'
      }));
    }
  }

  /**
   * Clean up expired pending bookings (temporary bookings older than 1 hour without payment)
   */
  async cleanupExpiredBookings() {
    try {
      logger.info('Starting cleanup of expired pending bookings');
      
      const transaction = await sequelize.transaction();
      
      try {
        // Find pending bookings older than 10 minutes
        const expiredBookings = await Booking.findAll({
          where: {
            status: 'pending',
            payment_status: 'pending',
            booking_date: {
              [Op.lt]: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
            }
          },
          transaction
        });

        if (expiredBookings.length === 0) {
          await transaction.commit();
          logger.info('No expired bookings found');
          return;
        }

        // Update expired bookings to cancelled
        const bookingIds = expiredBookings.map(booking => booking.id);
        
        await Booking.update(
          {
            status: 'cancelled',
            payment_status: 'expired'
          },
          {
            where: { id: { [Op.in]: bookingIds } },
            transaction
          }
        );

        // Update associated payments
        await Payment.update(
          {
            payment_status: 'expired'
          },
          {
            where: { booking_id: { [Op.in]: bookingIds } },
            transaction
          }
        );

        // Clean up any time slots (shouldn't exist with new logic, but clean up anyway)
        const deletedSlots = await TimeSlot.destroy({
          where: { booking_id: { [Op.in]: bookingIds } },
          transaction
        });

        await transaction.commit();
        
        logger.info(`Cleaned up ${expiredBookings.length} expired bookings and ${deletedSlots} time slots`);
        
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
      
    } catch (error) {
      logger.error('Error cleaning up expired bookings:', error);
    }
  }

  // Check and sync payment status from Stripe for a specific booking
  async syncPaymentStatus(req, res) {
    try {
      const { bookingId } = req.params;
      
      logger.info(`Syncing payment status for booking: ${bookingId}`);
      
      // Get booking with payment info
      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: Payment,
            as: 'payment' // Use consistent alias 'payment' instead of 'Payment'
          }
        ]
      });
      
      if (!booking) {
        return res.status(404).json(responseFormatter.error({ 
          code: 404, 
          message: 'Booking not found' 
        }));
      }
      
      // If booking is already confirmed, no need to sync
      if (booking.status === 'confirmed') {
        // Get booking details without field association
        const bookingDetails = await Booking.findByPk(bookingId, {
          include: [
            {
              model: TimeSlot,
              as: 'timeSlots'
            },
            {
              model: Payment,
              as: 'payment'
            }
          ]
        });
        
        // Get field data separately using metadata
        const fieldId = bookingDetails.booking_metadata?.fieldId;
        let fieldName = 'Unknown Field';
        if (fieldId) {
          const field = await Field.findByPk(fieldId, {
            attributes: ['name']
          });
          fieldName = field?.name || 'Unknown Field';
        }
        
        return res.json(responseFormatter.success({
          message: 'Booking already confirmed',
          booking: {
            id: bookingDetails.id,
            fieldName: fieldName,
            bookingDate: bookingDetails.booking_date,
            timeSlots: bookingDetails.timeslots?.map(slot => ({
              id: slot.id,
              startTime: slot.start_time,
              endTime: slot.end_time,
              subFieldName: slot.sub_field_name
            })) || [],
            totalAmount: bookingDetails.total_price,
            currency: bookingDetails.payment?.currency || 'vnd',
            status: bookingDetails.status,
            paymentStatus: bookingDetails.payment_status,
            customerInfo: bookingDetails.customer_info,
            createdAt: bookingDetails.created_at
          }
        }));
      }
      
      // If there's a payment record, check its status with Stripe
      if (booking.payment) {
        let paymentSucceeded = false;
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        // Check payment intent if available
        const stripePaymentIntentId = booking.payment.stripe_payment_intent_id;
        if (stripePaymentIntentId) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
            logger.info(`Retrieved payment intent from Stripe: ${paymentIntent.id}, status: ${paymentIntent.status}`);
            
            if (paymentIntent.status === 'succeeded') {
              paymentSucceeded = true;
            }
          } catch (stripeError) {
            logger.error('Error retrieving payment intent from Stripe:', stripeError);
          }
        }
        
        // If payment intent check didn't confirm success, try checking the session
        const stripeSessionId = booking.payment.stripe_session_id;
        if (!paymentSucceeded && stripeSessionId) {
          try {
            const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
            logger.info(`Retrieved checkout session from Stripe: ${session.id}, status: ${session.payment_status}`);
            
            if (session.payment_status === 'paid') {
              paymentSucceeded = true;
            }
          } catch (stripeError) {
            logger.error('Error retrieving session from Stripe:', stripeError);
          }
        }
        
        // If payment was successful but booking status is still payment_pending, update it
        if (paymentSucceeded && (booking.status === 'payment_pending' || booking.payment_status === 'pending')) {
          logger.info(`Payment succeeded but booking status not updated, fixing...`);
          
          const transaction = await sequelize.transaction();
          
          try {
            // Update booking status
            await booking.update({
              status: 'confirmed',
              payment_status: 'paid'
            }, { transaction });
            
            // Update payment record
            await booking.payment.update({
              status: 'succeeded', // Fixed: Use 'status' not 'payment_status'
              processed_at: new Date()
            }, { transaction });
            
            // Create time slots if they don't exist yet
            const { timeSlots, playDate } = booking.booking_metadata;
            
            if (timeSlots && timeSlots.length > 0) {
              const timeSlotPromises = timeSlots.map(async (timeSlot) => {
                // Check if slot already exists
                const existingSlot = await TimeSlot.findOne({
                  where: {
                    sub_field_id: timeSlot.sub_field_id,
                    date: playDate,
                    start_time: timeSlot.start_time,
                    booking_id: booking.id
                  },
                  transaction
                });

                if (!existingSlot) {
                  return await TimeSlot.create({
                    start_time: timeSlot.start_time,
                    end_time: timeSlot.end_time,
                    date: playDate,
                    sub_field_id: timeSlot.sub_field_id,
                    booking_id: booking.id,
                    status: 'booked'
                  }, { transaction });
                }
                return null;
              });

              await Promise.all(timeSlotPromises);
              logger.info(`Created/verified ${timeSlots.length} time slots for synced booking:`, booking.id);
            }
            
            await transaction.commit();
            logger.info(`Successfully synced booking ${bookingId} to confirmed status`);
            
            // Send confirmation emails after successful sync
            try {
              // Get booking details with full data for email
              const bookingWithDetails = await Booking.findByPk(booking.id, {
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                  },
                  {
                    model: TimeSlot,
                    as: 'timeSlots',
                    attributes: ['id', 'start_time', 'end_time', 'date', 'sub_field_id'],
                    include: [
                      {
                        model: SubField,
                        as: 'subfield',
                        attributes: ['id', 'name', 'field_id'],
                        include: [
                          {
                            model: Field,
                            as: 'field',
                            attributes: ['id', 'name', 'owner_id'],
                            include: [
                              {
                                model: User,
                                as: 'owner',
                                attributes: ['id', 'name', 'email']
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              });

              if (bookingWithDetails && bookingWithDetails.user && bookingWithDetails.timeSlots && bookingWithDetails.timeSlots.length > 0) {
                const firstTimeSlot = bookingWithDetails.timeSlots[0];
                const field = firstTimeSlot.subfield?.field;
                
                if (field) {
                  // Prepare booking details for email
                  const timeSlots = bookingWithDetails.timeSlots || [];
                  let startTime = '';
                  let endTime = '';
                  
                  // Create time ranges from start_time and end_time
                  const formatTime = (timeStr) => {
                    if (!timeStr) return '';
                    // timeStr is in format "HH:MM:SS", we want "HH:MM"
                    return timeStr.substring(0, 5);
                  };
                  
                  // Try to get time from TimeSlots first
                  if (timeSlots.length > 0) {
                    const firstSlot = timeSlots[0];
                    const lastSlot = timeSlots[timeSlots.length - 1];
                    startTime = firstSlot ? formatTime(firstSlot.start_time) : '';
                    endTime = lastSlot ? formatTime(lastSlot.end_time) : '';
                  }
                  
                  // Fallback to booking metadata if TimeSlots don't have proper data
                  if (!startTime || !endTime) {
                    const metadataTimeSlots = bookingWithDetails.booking_metadata?.timeSlots || [];
                    if (metadataTimeSlots.length > 0) {
                      const firstMetaSlot = metadataTimeSlots[0];
                      const lastMetaSlot = metadataTimeSlots[metadataTimeSlots.length - 1];
                      startTime = firstMetaSlot?.start_time || startTime;
                      endTime = lastMetaSlot?.end_time || endTime;
                    }
                  }
                  
                  const bookingDetails = {
                    fieldName: field.name,
                    customerName: bookingWithDetails.customer_info?.name || bookingWithDetails.user.name,
                    customerEmail: bookingWithDetails.customer_info?.email || bookingWithDetails.user.email,
                    customerPhone: bookingWithDetails.customer_info?.phone || 'Không có thông tin',
                    date: new Date(bookingWithDetails.booking_date).toLocaleDateString('vi-VN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }),
                    startTime: startTime,
                    endTime: endTime,
                    timeRange: `${startTime} - ${endTime}`,
                    totalAmount: bookingWithDetails.total_price,
                    bookingId: bookingWithDetails.id
                  };

                  // Send confirmation email to customer
                  if (bookingDetails.customerEmail) {
                    try {
                      logger.info('Sending confirmation email after sync with details:', {
                        customerEmail: bookingDetails.customerEmail,
                        timeRange: bookingDetails.timeRange,
                        startTime: startTime,
                        endTime: endTime,
                        source: 'syncPaymentStatus'
                      });
                      
                      await sendBookingConfirmationEmail(
                        bookingDetails.customerEmail,
                        bookingDetails.customerName,
                        bookingDetails
                      );
                      logEmailOperation('send', bookingDetails.customerEmail, 'booking_confirmation', true);
                      logger.info('Confirmation email sent to customer after sync:', bookingDetails.customerEmail);
                    } catch (emailError) {
                      logEmailOperation('send', bookingDetails.customerEmail, 'booking_confirmation', false, emailError);
                      logger.error('Failed to send confirmation email to customer after sync:', emailError);
                    }
                  }

                  // Send notification email to field owner
                  if (field.owner && field.owner.email) {
                    try {
                      await sendOwnerBookingNotificationEmail(
                        field.owner.email,
                        field.owner.name,
                        bookingDetails
                      );
                      logEmailOperation('send', field.owner.email, 'owner_notification', true);
                      logger.info('Notification email sent to field owner after sync:', field.owner.email);
                    } catch (emailError) {
                      logEmailOperation('send', field.owner.email, 'owner_notification', false, emailError);
                      logger.error('Failed to send notification email to field owner after sync:', emailError);
                    }
                  }
                }
              }
            } catch (emailError) {
              // Log email errors but don't fail the sync
              logger.error('Error sending confirmation emails after sync (sync still succeeded):', emailError);
            }
            
            // Get full booking details for the response (outside transaction)
            const updatedBooking = await Booking.findByPk(bookingId, {
              include: [
                {
                  model: TimeSlot,
                  as: 'timeSlots'
                },
                {
                  model: Payment,
                  as: 'payment'
                }
              ]
            });
            
            // Get field data separately
            const fieldId = updatedBooking.booking_metadata?.fieldId;
            let fieldName = 'Unknown Field';
            if (fieldId) {
              const field = await Field.findByPk(fieldId, {
                attributes: ['name']
              });
              fieldName = field?.name || 'Unknown Field';
            }
            
            return res.json(responseFormatter.success({
              message: 'Payment status synced successfully',
              booking: {
                id: updatedBooking.id,
                fieldName: fieldName,
                bookingDate: updatedBooking.booking_date,
                timeSlots: updatedBooking.timeslots?.map(slot => ({
                  id: slot.id,
                  startTime: slot.start_time,
                  endTime: slot.end_time,
                  subFieldName: slot.sub_field_name
                })) || [],
                totalAmount: updatedBooking.total_price,
                currency: updatedBooking.payment?.currency || 'vnd',
                status: updatedBooking.status,
                paymentStatus: updatedBooking.payment_status,
                customerInfo: updatedBooking.customer_info,
                createdAt: updatedBooking.created_at
              }
            }));
            
          } catch (transactionError) {
            // Only rollback if transaction is still active
            if (!transaction.finished) {
              await transaction.rollback();
            }
            logger.error('Transaction error during payment sync:', transactionError);
            throw transactionError;
          }
        }
        
        // Payment successful but booking is not in payment_pending state
        else if (paymentSucceeded) {
          logger.info(`Payment verified as successful, but booking status is already: ${booking.status}`);
          const bookingDetails = await Booking.findByPk(bookingId, {
            include: [
              {
                model: TimeSlot,
                as: 'timeSlots'
              },
              {
                model: Payment,
                as: 'payment'
              }
            ]
          });
          
          // Get field data separately
          const fieldId = bookingDetails.booking_metadata?.fieldId;
          let fieldName = 'Unknown Field';
          if (fieldId) {
            const field = await Field.findByPk(fieldId, {
              attributes: ['name']
            });
            fieldName = field?.name || 'Unknown Field';
          }
          
          return res.json(responseFormatter.success({
            message: 'Payment already verified',
            booking: {
              id: bookingDetails.id,
              fieldName: fieldName,
              bookingDate: bookingDetails.booking_date,
              timeSlots: bookingDetails.timeslots?.map(slot => ({
                id: slot.id,
                startTime: slot.start_time,
                endTime: slot.end_time,
                subFieldName: slot.sub_field_name
              })) || [],
              totalAmount: bookingDetails.total_price,
              currency: bookingDetails.payment?.currency || 'vnd',
              status: bookingDetails.status,
              paymentStatus: bookingDetails.payment_status,
              customerInfo: bookingDetails.customer_info,
              createdAt: bookingDetails.created_at
            }
          }));
        }
      }
      
      // If we reach here, no sync was needed or possible
      const fullBookingDetails = await Booking.findByPk(bookingId, {
        include: [
          {
            model: TimeSlot,
            as: 'timeSlots'
          },
          {
            model: Payment,
            as: 'payment'
          }
        ]
      });
      
      // Get field data separately
      const fieldId = fullBookingDetails.booking_metadata?.fieldId;
      let fieldName = 'Unknown Field';
      if (fieldId) {
        const field = await Field.findByPk(fieldId, {
          attributes: ['name']
        });
        fieldName = field?.name || 'Unknown Field';
      }
      
      return res.json(responseFormatter.success({
        message: 'No payment status changes needed',
        booking: {
          id: fullBookingDetails.id,
          fieldName: fieldName,
          bookingDate: fullBookingDetails.booking_date,
          timeSlots: fullBookingDetails.timeslots?.map(slot => ({
            id: slot.id,
            startTime: slot.start_time,
            endTime: slot.end_time,
            subFieldName: slot.sub_field_name
          })) || [],
          totalAmount: fullBookingDetails.total_price,
          currency: fullBookingDetails.payment?.currency || 'vnd',
          status: fullBookingDetails.status,
          paymentStatus: fullBookingDetails.payment_status,
          customerInfo: fullBookingDetails.customer_info,
          createdAt: fullBookingDetails.created_at
        }
      }));
      
    } catch (error) {
      logger.error('Error syncing payment status:', error);
      return res.status(500).json(responseFormatter.error({ 
        code: 500, 
        message: 'Error syncing payment status' 
      }));
    }
  }

  /**
   * Continue payment for an existing booking
   */
  async continuePaymentForBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { return_url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking/confirmation`, cancel_url } = req.body;
      
      logger.info(`Continuing payment for booking: ${bookingId}`);
      
      // Check if booking exists with proper nested includes
      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: TimeSlot,
            as: 'timeSlots',
            include: [
              {
                model: SubField,
                as: 'subfield',
                include: [
                  {
                    model: Field,
                    as: 'field',
                    include: [
                      {
                        model: Location,
                        as: 'location'
                      }
                    ]
                  }
                ]
              }
            ]
          },
          { 
            model: Payment, 
            as: 'payment' 
          }
        ]
      });
      
      if (!booking) {
        logger.error(`Booking not found: ${bookingId}`);
        return res.status(404).json(responseFormatter.error({
          code: 404,
          message: 'Booking not found'
        }));
      }
      
      // Check if booking status allows payment
      if (booking.status === 'cancelled') {
        return res.status(400).json(responseFormatter.error({
          code: 400,
          message: 'Booking has been cancelled'
        }));
      }
      
      if (booking.payment_status === 'paid') {
        return res.status(400).json(responseFormatter.error({
          code: 400,
          message: 'Booking has already been paid'
        }));
      }
      
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      // Get field information from nested relationship or fallback to metadata
      const firstTimeSlot = booking.timeSlots?.[0];
      let field = firstTimeSlot?.subfield?.field;
      
      // Fallback to metadata if relationship is missing (e.g., for cancelled bookings)
      if (!field && booking.booking_metadata?.fieldId) {
        console.log('Field relationship missing, using metadata fallback for booking:', bookingId);
        try {
          field = await Field.findByPk(booking.booking_metadata.fieldId, {
            include: [
              {
                model: Location,
                as: 'location'
              }
            ]
          });
        } catch (metadataError) {
          console.error('Error fetching field from metadata:', metadataError);
        }
      }
      
      if (!field) {
        logger.error('Field information not found for booking:', bookingId);
        return res.status(400).json(responseFormatter.error({
          code: 400,
          message: 'Field information not found'
        }));
      }

      // Create a new Checkout Session với đầy đủ thông tin customer
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: booking.customer_info?.email || '', // Thêm customer email
        line_items: [
          {
            price_data: {
              currency: 'vnd',
              product_data: {
                name: `Đặt sân ${field.name}`,
                description: `Ngày ${booking.booking_date}`,
                metadata: {
                  booking_id: booking.id,
                  field_name: field.name,
                  booking_date: booking.booking_date
                }
              },
              unit_amount: Math.round(booking.total_price) // VND doesn't have cents, use actual amount
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        metadata: {
          booking_id: booking.id,
          user_id: booking.user_id || 'guest',
          customer_email: booking.customer_info?.email || '',
          customer_name: booking.customer_info?.name || '',
          field_name: field.name,
          booking_date: booking.booking_date
        },
        success_url: `${new URL(return_url).origin}/booking-history?payment=success&booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancel_url || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking-history?payment=cancel`,
        client_reference_id: booking.id
      });
      
      // Update payment record with new session
      if (booking.payment) {
        await booking.payment.update({
          stripe_session_id: session.id,
          updated_at: new Date()
        });
      } else {
        // Create new payment record if one doesn't exist
        await Payment.create({
          booking_id: booking.id,
          status: 'pending',
          amount: booking.total_price,
          currency: 'vnd',
          customer_email: booking.customer_info?.email || '',
          customer_name: booking.customer_info?.name || '',
          stripe_session_id: session.id,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      return res.status(200).json(responseFormatter.success({
        message: 'Payment session created successfully',
        data: {
          booking_id: booking.id,
          checkout_url: session.url,
          session_id: session.id,
          payment_id: booking.payment?.id || null,
          amount: booking.total_price,
          currency: 'vnd'
        }
      }));
      
    } catch (error) {
      logger.error('Error continuing payment:', error);
      return res.status(500).json(responseFormatter.error({
        code: 500,
        message: 'Failed to create payment session'
      }));
    }
  }

  /**
   * Helper method to get full booking details
   * @private
   */
  async getBookingDetails(bookingId) {
    try {
      // Find the booking with its related data
      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: TimeSlot,
            as: 'timeSlots'
          },
          {
            model: Payment,
            as: 'payment'
          }
        ]
      });
      
      if (!booking) {
        logger.error(`getBookingDetails: No booking found with ID ${bookingId}`);
        return null;
      }
      
      logger.info(`getBookingDetails: Found booking ${bookingId} with payment status: ${booking.payment_status}`);
      
      // Get field data with full details
      const field = await Field.findByPk(booking.booking_metadata.fieldId, {
        include: [
          {
            model: Location,
            as: 'location',
            attributes: ['address_text', 'city', 'district', 'ward']
          },
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'name', 'phone']
          },
          {
            model: SubField,
            as: 'subfields',
            attributes: ['id', 'name', 'field_type']
          }
        ],
        attributes: [
          'id',
          'name',
          'description',
          'price_per_hour',
          'images1',
          'images2',
          'images3',
          'is_verified',
          'created_at'
        ]
      });
      
      if (!field) {
        logger.error(`getBookingDetails: No field found for booking ${bookingId}`);
        return null;
      }

      // Format booking data for response
      return {
        id: booking.id,
        bookingDate: booking.booking_metadata.playDate,
        field: {
          id: field.id,
          name: field.name,
          description: field.description || '',
          price_per_hour: field.price_per_hour || 0,
          images1: field.images1 || '',
          location: {
            address_text: field.location?.address_text || '',
            city: field.location?.city || '',
            district: field.location?.district || '',
            ward: field.location?.ward || ''
          },
          owner: {
            id: field.owner?.id || '',
            name: field.owner?.name || ''
          },
          subfields: field.subfields?.map(subfield => ({
            id: subfield.id,
            name: subfield.name,
            field_type: subfield.field_type
          })) || []
        },
        timeSlots: booking.timeslots?.map(slot => ({
          startTime: slot.start_time,
          endTime: slot.end_time,
          sub_field_id: slot.sub_field_id
        })) || [],
        totalAmount: booking.total_price,
        currency: booking.payment?.currency || 'vnd',
        status: booking.status,
        paymentStatus: booking.payment_status,
        customerInfo: booking.customer_info,
        createdAt: booking.created_at
      };
    } catch (error) {
      logger.error(`Error in getBookingDetails for booking ${bookingId}:`, error);
      return null;
    }
  }

  /**
   * Create payment intent for package purchase
   */
  async createPackagePayment(req, res) {
    logger.info('createPackagePayment method called');
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(responseFormatter.error({
          code: 'UNAUTHORIZED',
          message: 'Bạn cần đăng nhập để mua gói dịch vụ'
       
        }));
      }
      const { packageType, return_url, cancel_url } = req.body;
      if (!packageType || !['basic', 'premium'].includes(packageType)) {
        return res.status(400).json(responseFormatter.error({
          code: 400,
          message: 'Loại gói dịch vụ không hợp lệ'
        }));
      }
      // Lấy giá từ config (tránh user tự gửi giá)
      const SERVICE_PLANS = {
        basic: 599000,
        premium: 3099000
      };
      const amount = SERVICE_PLANS[packageType];
      // Tạo session thanh toán Stripe (hoặc VNPay...)
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'vnd',
              product_data: {
                name: `Gói dịch vụ: ${packageType}`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: return_url || process.env.FRONTEND_URL + '/payment/success',
        cancel_url: cancel_url || process.env.FRONTEND_URL + '/payment/cancel',
        metadata: {
          type: 'package',
          userId,
          packageType
        },
        client_reference_id: userId
      });
      return res.json(responseFormatter.success({
        checkout_url: session.url,
        session_id: session.id,
        amount,
        currency: 'vnd',
        packageType
      }));
    } catch (error) {
      logger.error('Error in createPackagePayment:', error);
      return res.status(500).json(responseFormatter.error({
        code: 500,
        message: error.message
      }));
    }
  }

  // Get package status for current user
  async getPackageStatus(req, res) {
    try {
      const userId = req.user.id;
      
      const user = await User.findByPk(userId, {
        attributes: ['id', 'package_type', 'package_expire_date', 'package_purchase_date'],
        include: [{
          model: Field,
          as: 'ownedFields',
          attributes: ['id', 'is_verified'],
          required: false
        }]
      });

      if (!user) {
        return res.status(404).json(responseFormatter.error({
          code: 'USER_NOT_FOUND',
          message: 'Không tìm thấy thông tin người dùng'
        }));
      }

      const packageType = user.package_type || 'none';
      const hasPackage = packageType !== 'none';
      const expireDate = user.package_expire_date ? new Date(user.package_expire_date) : null;
      const purchaseDate = user.package_purchase_date ? new Date(user.package_purchase_date) : null;

      let packageStatus = {
        hasPackage,
        packageType,
        isExpired: false,
        isExpiringSoon: false,
        daysUntilExpiry: 0,
        expireDate: expireDate ? expireDate.toISOString() : null,
        purchaseDate: purchaseDate ? purchaseDate.toISOString() : null,
        fieldsAffected: 0
      };

      if (hasPackage && expireDate) {
        const now = new Date();
        const isExpired = expireDate < now;
        const daysUntilExpiry = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = !isExpired && daysUntilExpiry <= 7;

        // Đếm số sân bị ảnh hưởng
        const fieldsAffected = user.ownedFields ? user.ownedFields.length : 0;

        packageStatus = {
          ...packageStatus,
          isExpired,
          isExpiringSoon,
          daysUntilExpiry: Math.max(0, daysUntilExpiry),
          fieldsAffected
        };
      }

      return res.json(responseFormatter.success(packageStatus));
    } catch (error) {
      logger.error('Error in getPackageStatus:', error);
      return res.status(500).json(responseFormatter.error({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Đã có lỗi xảy ra khi lấy thông tin gói dịch vụ'
      }));
    }
  }
}

module.exports = new PaymentController();
