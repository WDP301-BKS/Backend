const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const rateLimiter = require('../utils/rateLimiter');
const roomManager = require('../utils/roomManager');
const messageHistory = require('../utils/messageHistory');
const logger = require('../utils/logger');

let io;
const onlineUsers = new Map();

// Socket configuration and initialization
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      
      if (!user || !user.is_active) {
        return next(new Error('Authentication error: User not found or inactive'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.userName = user.name;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handling
  io.on('connection', (socket) => {
    logger.info(`User ${socket.userId} (${socket.userName}) connected with socket ${socket.id}`);
    
    // Add user to online users map
    onlineUsers.set(socket.userId, {
      socketId: socket.id,
      userId: socket.userId,
      userName: socket.userName,
      userRole: socket.userRole,
      connectedAt: new Date()
    });

    // Join user's personal room for direct notifications
    socket.join(`user_${socket.userId}`);

    // Emit user online status to all connections
    socket.broadcast.emit('user_status_change', {
      userId: socket.userId,
      status: 'online'
    });

    // Handle user online event
    socket.on('user_online', () => {
      socket.broadcast.emit('user_online_status', {
        userId: socket.userId,
        isOnline: true,
        timestamp: new Date()
      });
    });

    // Handle user offline event
    socket.on('user_offline', () => {
      socket.broadcast.emit('user_online_status', {
        userId: socket.userId,
        isOnline: false,
        timestamp: new Date()
      });
    });

    // Chat-related event handlers
    setupChatEvents(socket);
    
    // Booking-related event handlers
    setupBookingEvents(socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User ${socket.userId} disconnected`);
      
      // Remove from online users
      onlineUsers.delete(socket.userId);
      
      // Emit user offline status
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        status: 'offline'
      });

      socket.broadcast.emit('user_online_status', {
        userId: socket.userId,
        isOnline: false,
        timestamp: new Date()
      });
    });
  });

  return io;
};

        // Chat event handlers
const setupChatEvents = (socket) => {
  // Join chat room
  socket.on('join_chat', async (data) => {
    try {
      const { chatId } = data;
      
      // Rate limiting
      if (!rateLimiter.checkLimit(socket.userId, 'join_chat')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many join requests. Please try again later.'
        });
        return;
      }

      // Check if user can join this chat
      const canJoin = await roomManager.canUserJoinChat(socket.userId, chatId);
      if (!canJoin) {
        socket.emit('error', {
          type: 'UNAUTHORIZED',
          message: 'You do not have permission to join this chat'
        });
        return;
      }

      // Join the chat room
      socket.join(`chat_${chatId}`);
      logger.info(`User ${socket.userId} joined chat ${chatId}`);

      // Send recent message history
      const recentMessages = await messageHistory.getRecentMessages(chatId);
      socket.emit('chat_history', {
        chatId,
        messages: recentMessages
      });

      socket.emit('chat_joined', { chatId });
    } catch (error) {
      logger.error('Error joining chat:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to join chat'
      });
    }
  });

  // Leave chat room
  socket.on('leave_chat', (data) => {
    try {
      const { chatId } = data;
      
      // Rate limiting
      if (!rateLimiter.checkLimit(socket.userId, 'leave_chat')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many leave requests. Please try again later.'
        });
        return;
      }

      socket.leave(`chat_${chatId}`);
      logger.info(`User ${socket.userId} left chat ${chatId}`);
      
      socket.emit('chat_left', { chatId });
    } catch (error) {
      logger.error('Error leaving chat:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to leave chat'
      });
    }
  });

  // Handle typing start
  socket.on('typing_start', (data) => {
    try {
      const { chatId } = data;
      
      // Rate limiting
      if (!rateLimiter.checkLimit(socket.userId, 'typing_start')) {
        return; // Silently ignore to avoid spam
      }

      socket.to(`chat_${chatId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.userName,
        chatId
      });
    } catch (error) {
      logger.error('Error handling typing start:', error);
    }
  });

  // Handle typing stop
  socket.on('typing_stop', (data) => {
    try {
      const { chatId } = data;
      
      // Rate limiting
      if (!rateLimiter.checkLimit(socket.userId, 'typing_stop')) {
        return; // Silently ignore to avoid spam
      }

      socket.to(`chat_${chatId}`).emit('user_stop_typing', {
        userId: socket.userId,
        chatId
      });
    } catch (error) {
      logger.error('Error handling typing stop:', error);
    }
  });

  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content } = data;
      
      // Rate limiting
      if (!rateLimiter.checkLimit(socket.userId, 'send_message')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many messages. Please slow down.'
        });
        return;
      }

      // Validate input
      if (!chatId || !content || content.trim().length === 0) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Chat ID and message content are required'
        });
        return;
      }

      // Check if user can send messages to this chat
      const canSend = await roomManager.isUserParticipant(socket.userId, chatId);
      if (!canSend) {
        socket.emit('error', {
          type: 'UNAUTHORIZED',
          message: 'You do not have permission to send messages to this chat'
        });
        return;
      }

      // The actual message creation will be handled by the chat controller
      // This socket event is just for real-time notification
      socket.emit('message_sent', {
        chatId,
        content: content.trim(),
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to send message'
      });
    }
  });

  // Mark messages as read
  socket.on('mark_messages_read', async (data) => {
    try {
      const { chatId } = data;
      
      if (!chatId) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Chat ID is required'
        });
        return;
      }

      // Mark messages as read (this will be handled by the service)
      const readCount = await messageHistory.markMessagesAsRead(chatId, socket.userId);
      
      if (readCount > 0) {
        // Emit to the chat room that messages were read
        socket.to(`chat_${chatId}`).emit('messages_read', {
          chatId,
          readData: {
            userId: socket.userId,
            readAt: new Date()
          }
        });
      }

    } catch (error) {
      logger.error('Error marking messages as read:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to mark messages as read'
      });
    }
  });

  // Load more messages
  socket.on('load_more_messages', async (data) => {
    try {
      const { chatId, page = 1, beforeMessageId } = data;
      
      if (!chatId) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Chat ID is required'
        });
        return;
      }

      // Check if user has access to this chat
      const hasAccess = await roomManager.isUserParticipant(socket.userId, chatId);
      if (!hasAccess) {
        socket.emit('error', {
          type: 'UNAUTHORIZED',
          message: 'You do not have permission to access this chat'
        });
        return;
      }

      const messagesData = await messageHistory.getMessagesWithPagination(
        chatId, 
        page, 
        20, 
        beforeMessageId
      );

      socket.emit('more_messages_loaded', {
        chatId,
        messages: messagesData.messages,
        hasMore: messagesData.hasMore,
        page: messagesData.page
      });

    } catch (error) {
      logger.error('Error loading more messages:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to load more messages'
      });
    }
  });

  // Get user online status
  socket.on('get_user_online_status', (data) => {
    try {
      const { userId } = data;
      
      if (!userId) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'User ID is required'
        });
        return;
      }

      const isOnline = onlineUsers.has(userId);
      socket.emit('user_online_status', {
        userId,
        isOnline,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error getting user online status:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to get user online status'
      });
    }
  });

  // Update online status
  socket.on('update_online_status', (data) => {
    try {
      const { isOnline } = data;
      
      if (isOnline) {
        onlineUsers.set(socket.userId, {
          socketId: socket.id,
          userId: socket.userId,
          userName: socket.userName,
          userRole: socket.userRole,
          connectedAt: new Date()
        });
      } else {
        onlineUsers.delete(socket.userId);
      }

      socket.broadcast.emit('user_online_status', {
        userId: socket.userId,
        isOnline,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error updating online status:', error);
    }
  });
};

// Booking event handlers
const setupBookingEvents = (socket) => {
  // Subscribe to booking status updates
  socket.on('subscribe_booking', async (data) => {
    try {
      const { bookingId } = data;
      
      // Rate limiting check
      if (!rateLimiter.checkLimit(socket.userId, 'subscribe_booking')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many booking subscription requests. Please try again later.'
        });
        return;
      }

      // Validate input
      if (!bookingId) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Booking ID is required'
        });
        return;
      }

      // Check if user has permission to access this booking
      const { Booking } = require('../models');
      const { Op } = require('sequelize');
      const booking = await Booking.findOne({
        where: { 
          id: bookingId,
          [Op.or]: [
            { user_id: socket.userId },
            // Allow field owners to track bookings for their fields if needed
          ]
        }
      });

      if (!booking) {
        socket.emit('error', {
          type: 'UNAUTHORIZED',
          message: 'You do not have permission to access this booking'
        });
        return;
      }

      // Join the booking room
      socket.join(`booking_${bookingId}`);
      logger.info(`User ${socket.userId} subscribed to booking ${bookingId}`);

      // Send current booking status
      socket.emit('booking_status_update', {
        bookingId,
        status: booking.status,
        paymentStatus: booking.payment_status,
        timestamp: new Date()
      });

      socket.emit('booking_subscription_success', {
        bookingId,
        status: booking.status,
        paymentStatus: booking.payment_status
      });

    } catch (error) {
      logger.error('Error subscribing to booking:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to subscribe to booking updates'
      });
    }
  });

  // Unsubscribe from booking status updates
  socket.on('unsubscribe_booking', (data) => {
    try {
      const { bookingId } = data;
      
      // Rate limiting check
      if (!rateLimiter.checkLimit(socket.userId, 'unsubscribe_booking')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many booking unsubscription requests. Please try again later.'
        });
        return;
      }

      if (!bookingId) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Booking ID is required'
        });
        return;
      }

      socket.leave(`booking_${bookingId}`);
      logger.info(`User ${socket.userId} unsubscribed from booking ${bookingId}`);

      socket.emit('booking_unsubscription_success', { bookingId });

    } catch (error) {
      logger.error('Error unsubscribing from booking:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to unsubscribe from booking updates'
      });
    }
  });

  // Manual sync booking status request
  socket.on('sync_booking_status', async (data) => {
    try {
      const { bookingId } = data;
      
      // Rate limiting check
      if (!rateLimiter.checkLimit(socket.userId, 'sync_booking_status')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many sync requests. Please try again later.'
        });
        return;
      }

      if (!bookingId) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Booking ID is required'
        });
        return;
      }

      // Check permission and get booking
      const { Booking } = require('../models');
      const booking = await Booking.findOne({
        where: { 
          id: bookingId,
          user_id: socket.userId
        }
      });

      if (!booking) {
        socket.emit('error', {
          type: 'UNAUTHORIZED',
          message: 'You do not have permission to sync this booking'
        });
        return;
      }

      // Trigger payment status sync
      const { paymentService } = require('../services');
      const syncResult = await paymentService.syncPaymentStatus(bookingId);

      if (syncResult.success && syncResult.booking) {
        // Emit updated status to booking room
        emitBookingStatusUpdate(bookingId, {
          status: syncResult.booking.status,
          paymentStatus: syncResult.booking.payment_status,
          previousStatus: booking.status,
          previousPaymentStatus: booking.payment_status,
          syncTriggeredBy: socket.userId,
          timestamp: new Date()
        });
      }

      socket.emit('booking_sync_complete', {
        bookingId,
        success: syncResult.success,
        booking: syncResult.booking,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error syncing booking status:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to sync booking status'
      });
    }
  });
};

    // Emit new message to chat participants
const emitNewMessage = (chatId, messageData) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!chatId || !messageData) {
      logger.warn('Invalid parameters for emitNewMessage');
      return false;
    }
    
    // Emit to chat room
    io.to(`chat_${chatId}`).emit('new_message', {
      chatId,
      ...messageData,
      timestamp: new Date()
    });
    
    logger.info(`New message emitted to chat ${chatId}`);
    return true;
  } catch (error) {
    logger.error('Error emitting new message:', error);
    return false;
  }
};

// Emit booking status update to subscribers
const emitBookingStatusUpdate = (bookingId, statusData) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!bookingId || !statusData) {
      logger.warn('Invalid parameters for emitBookingStatusUpdate');
      return false;
    }
    
    // Emit to booking room (subscribed users)
    io.to(`booking_${bookingId}`).emit('booking_status_update', {
      bookingId,
      ...statusData,
      timestamp: new Date()
    });
    
    // Also emit to user's personal room if user_id is available
    if (statusData.userId) {
      io.to(`user_${statusData.userId}`).emit('booking_status_update', {
        bookingId,
        ...statusData,
        timestamp: new Date()
      });
    }
    
    logger.info(`Booking status update emitted for booking ${bookingId}`);
    return true;
  } catch (error) {
    logger.error('Error emitting booking status update:', error);
    return false;
  }
};

// Emit booking payment status update
const emitBookingPaymentUpdate = (bookingId, paymentData) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!bookingId || !paymentData) {
      logger.warn('Invalid parameters for emitBookingPaymentUpdate');
      return false;
    }
    
    // Emit to booking room
    io.to(`booking_${bookingId}`).emit('booking_payment_update', {
      bookingId,
      ...paymentData,
      timestamp: new Date()
    });
    
    // Also emit to user's personal room
    if (paymentData.userId) {
      io.to(`user_${paymentData.userId}`).emit('booking_payment_update', {
        bookingId,
        ...paymentData,
        timestamp: new Date()
      });
    }
    
    logger.info(`Booking payment update emitted for booking ${bookingId}`);
    return true;
  } catch (error) {
    logger.error('Error emitting booking payment update:', error);
    return false;
  }
};

// Emit general booking event (for confirmations, cancellations, etc.)
const emitBookingEvent = (eventType, bookingId, eventData) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!eventType || !bookingId || !eventData) {
      logger.warn('Invalid parameters for emitBookingEvent');
      return false;
    }
    
    // Emit to booking room
    io.to(`booking_${bookingId}`).emit('booking_event', {
      eventType,
      bookingId,
      ...eventData,
      timestamp: new Date()
    });
    
    // Also emit to user's personal room
    if (eventData.userId) {
      io.to(`user_${eventData.userId}`).emit('booking_event', {
        eventType,
        bookingId,
        ...eventData,
        timestamp: new Date()
      });
    }
    
    logger.info(`Booking event '${eventType}' emitted for booking ${bookingId}`);
    return true;
  } catch (error) {
    logger.error('Error emitting booking event:', error);
    return false;
  }
};

// Emit user notification to personal room
const emitUserNotification = (userId, notificationData) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!userId || !notificationData) {
      logger.warn('Invalid parameters for emitUserNotification');
      return false;
    }
    
    // Emit to user's personal room
    io.to(`user_${userId}`).emit('user_notification', {
      userId,
      ...notificationData,
      timestamp: new Date()
    });
    
    logger.info(`User notification emitted to user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error emitting user notification:', error);
    return false;
  }
};

// Check if user is online
const isUserOnline = (userId) => {
  try {
    return onlineUsers.has(userId);
  } catch (error) {
    logger.error('Error checking user online status:', error);
    return false;
  }
};

// Get online users count
const getOnlineUsersCount = () => {
  try {
    return onlineUsers.size;
  } catch (error) {
    logger.error('Error getting online users count:', error);
    return 0;
  }
};

// Get online users list
const getOnlineUsersList = () => {
  try {
    return Array.from(onlineUsers.values()).map(user => ({
      userId: user.userId,
      userName: user.userName,
      userRole: user.userRole,
      connectedAt: user.connectedAt
    }));
  } catch (error) {
    logger.error('Error getting online users list:', error);
    return [];
  }
};

// Disconnect user from all rooms
const disconnectUser = (userId) => {
  try {
    const user = onlineUsers.get(userId);
    if (user && user.socketId) {
      const socket = io.sockets.sockets.get(user.socketId);
      if (socket) {
        socket.disconnect(true);
        logger.info(`User ${userId} disconnected`);
        return true;
      }
    }
    return false;
  } catch (error) {
    logger.error('Error disconnecting user:', error);
    return false;
  }
};

// Module exports
module.exports = {
  initializeSocket,
  emitNewMessage,
  emitBookingStatusUpdate,
  emitBookingPaymentUpdate,
  emitBookingEvent,
  emitUserNotification,
  isUserOnline,
  getOnlineUsersCount,
  getOnlineUsersList,
  disconnectUser
};