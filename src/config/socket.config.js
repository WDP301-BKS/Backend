const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { User } = require('../models');
const rateLimiter = require('../utils/rateLimiter');
const roomManager = require('../utils/roomManager');
const messageHistory = require('../utils/messageHistory');

let io;
const onlineUsers = new Map();

// Socket configuration and initialization
const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      logger.info('JWT decoded payload:', decoded);
      
      // Get user info - the JWT payload has 'id' not 'userId'
      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'name', 'email', 'role', 'profileImage', 'is_active']
      });

      if (!user || !user.is_active) {
        return next(new Error('Authentication error: User not found or inactive'));
      }

      socket.userId = user.id;
      socket.user = user;
      socket.userRole = user.role;
      socket.userName = user.name;
      
      logger.info(`User ${user.name} (${user.id}) connected via socket`);
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection event
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

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);
    logger.info(`User ${socket.userId} joined personal room: user_${socket.userId}`);
    
    // Broadcast user online status to others
    socket.broadcast.emit('user_status_change', {
      userId: socket.userId,
      status: 'online'
    });
    
    logger.info(`User ${socket.userId} is now online`);

    // Chat-related event handlers
    setupChatEvents(socket);
    
    // Booking-related event handlers
    setupBookingEvents(socket);

    // Handle user online event
    socket.on('user_online', () => {
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        status: 'online'
      });

      socket.broadcast.emit('user_online_status', {
        userId: socket.userId,
        isOnline: true,
        timestamp: new Date()
      });
    });

    // Handle user offline event
    socket.on('user_offline', () => {
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: new Date().toISOString()
      });

      socket.broadcast.emit('user_online_status', {
        userId: socket.userId,
        isOnline: false,
        timestamp: new Date()
      });
    });

    // Handle update online status
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

        socket.broadcast.emit('user_status_change', {
          userId: socket.userId,
          status: isOnline ? 'online' : 'offline',
          lastSeen: isOnline ? null : new Date().toISOString()
        });

        socket.broadcast.emit('user_online_status', {
          userId: socket.userId,
          isOnline,
          timestamp: new Date()
        });
        
        logger.info(`User ${socket.userId} status updated to: ${isOnline ? 'online' : 'offline'}`);
      } catch (error) {
        logger.error('Error updating online status:', error);
      }
    });

    // Handle get user online status
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

        // Check if user is online by checking if they have active socket connections
        const isOnline = onlineUsers.has(userId);
        
        socket.emit('user_online_status', {
          userId,
          isOnline,
          timestamp: new Date()
        });
        
        logger.info(`Online status check for user ${userId}: ${isOnline}`);
      } catch (error) {
        logger.error('Error getting user online status:', error);
        socket.emit('error', {
          type: 'SERVER_ERROR',
          message: 'Failed to get user online status'
        });
      }
    });

    // Handle reconnection
    socket.on('reconnect_request', async (data) => {
      try {
        const { lastSeenMessageId, chatIds = [] } = data;
        
        logger.info(`User ${socket.userId} requesting reconnection`);
        
        // Rejoin user rooms
        socket.join(`user_${socket.userId}`);
        
        // Rejoin authorized chat rooms
        for (const chatId of chatIds) {
          const canJoin = await roomManager.canUserJoinChat(socket.userId, chatId);
          if (canJoin) {
            socket.join(`chat_${chatId}`);
            
            // Get unread count
            const unreadCount = await messageHistory.getUnreadCount(chatId, socket.userId);
            
            socket.emit('chat_reconnected', {
              chatId,
              unreadCount
            });
          }
        }

        // Send reconnection success
        socket.emit('reconnection_success', {
          userId: socket.userId,
          timestamp: new Date()
        });

      } catch (error) {
        logger.error('Error handling reconnection:', error);
        socket.emit('error', {
          type: 'SERVER_ERROR',
          message: 'Failed to handle reconnection'
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} for user: ${socket.userId}`);
      
      // Remove from online users
      onlineUsers.delete(socket.userId);
      
      // Broadcast user offline status
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: new Date().toISOString()
      });

      socket.broadcast.emit('user_online_status', {
        userId: socket.userId,
        isOnline: false,
        timestamp: new Date()
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  return io;
};

// Chat event handlers
const setupChatEvents = (socket) => {
  // Handle joining chat rooms
  socket.on('join_chat', async (data) => {
    try {
      const { chatId } = data;
      
      // Rate limiting check
      if (!rateLimiter.checkLimit(socket.userId, 'join_chat')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many join chat requests. Please try again later.',
          remainingRequests: rateLimiter.getRemainingRequests(socket.userId, 'join_chat')
        });
        return;
      }

      // Validate input
      if (!chatId) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Chat ID is required'
        });
        return;
      }

      // Check permissions
      const canJoin = await roomManager.canUserJoinChat(socket.userId, chatId);
      if (!canJoin) {
        socket.emit('error', {
          type: 'UNAUTHORIZED',
          message: 'You do not have permission to join this chat'
        });
        return;
      }

      // Join the room
      socket.join(`chat_${chatId}`);
      logger.info(`User ${socket.userId} joined chat ${chatId}`);

      // Send recent message history
      const recentMessages = await messageHistory.getRecentMessages(chatId, 50);
      socket.emit('chat_history', {
        chatId,
        messages: recentMessages
      });

      // Mark messages as read
      const readCount = await messageHistory.markMessagesAsRead(chatId, socket.userId);
      if (readCount > 0) {
        // Get chat participants to emit to their personal rooms
        const chat = await roomManager.getChat(chatId);
        if (chat) {
          const participants = [chat.user_id1, chat.user_id2];
          emitMessagesRead(chatId, participants, {
            userId: socket.userId,
            readAt: new Date()
          });
        }
      }

      // Send success response
      socket.emit('join_chat_success', {
        chatId,
        messageCount: recentMessages.length,
        unreadCount: await messageHistory.getUnreadCount(chatId, socket.userId)
      });

    } catch (error) {
      logger.error('Error joining chat:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to join chat'
      });
    }
  });

  // Handle leaving chat rooms
  socket.on('leave_chat', (data) => {
    try {
      const { chatId } = data;
      
      // Rate limiting check
      if (!rateLimiter.checkLimit(socket.userId, 'leave_chat')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many leave chat requests. Please try again later.'
        });
        return;
      }

      if (!chatId) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Chat ID is required'
        });
        return;
      }

      socket.leave(`chat_${chatId}`);
      logger.info(`User ${socket.userId} left chat ${chatId}`);
      
      socket.emit('leave_chat_success', { chatId });
    } catch (error) {
      logger.error('Error leaving chat:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to leave chat'
      });
    }
  });

  // Handle typing events
  socket.on('typing_start', (data) => {
    try {
      // Rate limiting check
      if (!rateLimiter.checkLimit(socket.userId, 'typing_start')) {
        return; // Silently ignore to avoid spam
      }

      if (!data || !data.chatId) {
        return; // Silently ignore invalid data for typing events
      }

      socket.to(`chat_${data.chatId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.userName,
        chatId: data.chatId
      });
    } catch (error) {
      logger.error('Error handling typing start:', error);
    }
  });

  socket.on('typing_stop', (data) => {
    try {
      // Rate limiting check
      if (!rateLimiter.checkLimit(socket.userId, 'typing_stop')) {
        return; // Silently ignore to avoid spam
      }

      if (!data || !data.chatId) {
        return; // Silently ignore invalid data for typing events
      }

      socket.to(`chat_${data.chatId}`).emit('user_stop_typing', {
        userId: socket.userId,
        chatId: data.chatId
      });
    } catch (error) {
      logger.error('Error handling typing stop:', error);
    }
  });

  // Handle load more messages
  socket.on('load_more_messages', async (data) => {
    try {
      const { chatId, page = 1, limit = 20, beforeMessageId } = data;
      
      // Rate limiting check
      if (!rateLimiter.checkLimit(socket.userId, 'load_more_messages')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many load messages requests. Please try again later.'
        });
        return;
      }

      // Validate input
      if (!chatId) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Chat ID is required'
        });
        return;
      }

      // Check permissions
      const canAccess = await roomManager.canUserJoinChat(socket.userId, chatId);
      if (!canAccess) {
        socket.emit('error', {
          type: 'UNAUTHORIZED',
          message: 'You do not have permission to access this chat'
        });
        return;
      }

      // Get messages with pagination
      const result = await messageHistory.getMessagesWithPagination(chatId, page, limit, beforeMessageId);
      
      socket.emit('more_messages', {
        chatId,
        ...result
      });

    } catch (error) {
      logger.error('Error loading more messages:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to load more messages'
      });
    }
  });

  // Handle mark messages as read
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

      // Check permissions
      const canAccess = await roomManager.canUserJoinChat(socket.userId, chatId);
      if (!canAccess) {
        socket.emit('error', {
          type: 'UNAUTHORIZED',
          message: 'You do not have permission to access this chat'
        });
        return;
      }

      // Mark messages as read
      const readCount = await messageHistory.markMessagesAsRead(chatId, socket.userId);
      
      if (readCount > 0) {
        // Get chat participants to emit to their personal rooms
        const chat = await roomManager.getChat(chatId);
        if (chat) {
          const participants = [chat.user_id1, chat.user_id2];
          emitMessagesRead(chatId, participants, {
            userId: socket.userId,
            readAt: new Date()
          });
        }
      }

      socket.emit('messages_marked_read', {
        chatId,
        readCount
      });

    } catch (error) {
      logger.error('Error marking messages as read:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to mark messages as read'
      });
    }
  });

  // Handle sending message via socket
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content } = data;
      
      // Rate limiting check
      if (!rateLimiter.checkLimit(socket.userId, 'send_message')) {
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many send message requests. Please try again later.'
        });
        return;
      }

      // Validate input
      if (!chatId || !content || !content.trim()) {
        socket.emit('error', {
          type: 'INVALID_INPUT',
          message: 'Chat ID and message content are required'
        });
        return;
      }

      // Check permissions
      const canAccess = await roomManager.canUserJoinChat(socket.userId, chatId);
      if (!canAccess) {
        socket.emit('error', {
          type: 'UNAUTHORIZED',
          message: 'You do not have permission to send messages in this chat'
        });
        return;
      }

      // Import chat service here to avoid circular dependency
      const { chatService } = require('../services');
      
      // Send message
      const message = await chatService.sendMessage(chatId, socket.userId, content.trim());
      
      // Get chat participants to emit to all of them
      const participants = await roomManager.getChatParticipants(chatId);
      
      // Emit to all participants in the chat room (for those currently in chat)
      io.to(`chat_${chatId}`).emit('new_message', message);
      
      // Also emit to each participant's personal room (for chat list updates)
      participants.forEach(participant => {
        if (participant && participant.id) {
          io.to(`user_${participant.id}`).emit('new_message', message);
          logger.info(`New message emitted to user_${participant.id} personal room`);
        }
      });
      
      // Send confirmation to sender
      socket.emit('message_sent', {
        messageId: message.id,
        chatId,
        timestamp: new Date()
      });

      logger.info(`Message sent via socket by user ${socket.userId} in chat ${chatId} to ${participants.length} participants`);

    } catch (error) {
      logger.error('Error sending message via socket:', error);
      socket.emit('error', {
        type: 'SERVER_ERROR',
        message: 'Failed to send message'
      });
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

// Get Socket.IO instance
const getSocketInstance = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};

// Emit new message to chat participants
const emitNewMessage = async (chatId, message) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!chatId || !message) {
      logger.warn('Invalid parameters for emitNewMessage');
      return false;
    }
    
    // Emit to chat room (for users currently in chat)
    io.to(`chat_${chatId}`).emit('new_message', message);
    
    // Get participants and emit to their personal rooms (for chat list updates)
    try {
      const participants = await roomManager.getChatParticipants(chatId);
      participants.forEach(participant => {
        if (participant && participant.id) {
          io.to(`user_${participant.id}`).emit('new_message', message);
        }
      });
      logger.info(`New message emitted to chat ${chatId} and ${participants.length} participants`);
    } catch (error) {
      logger.error('Error getting participants for message emit:', error);
      // Fallback to just chat room
      logger.info(`New message emitted to chat ${chatId} (fallback)`);
    }
    
    return true;
  } catch (error) {
    logger.error('Error emitting new message:', error);
    return false;
  }
};

// Emit message deleted to chat participants
const emitMessageDeleted = (chatId, messageId) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!chatId || !messageId) {
      logger.warn('Invalid parameters for emitMessageDeleted');
      return false;
    }
    io.to(`chat_${chatId}`).emit('message_deleted', { messageId, chatId });
    logger.info(`Message deletion emitted to chat ${chatId}`);
    return true;
  } catch (error) {
    logger.error('Error emitting message deletion:', error);
    return false;
  }
};

// Emit new chat created to users
const emitNewChat = (userIds, chat) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!Array.isArray(userIds) || !chat) {
      logger.warn('Invalid parameters for emitNewChat');
      return false;
    }
    userIds.forEach(userId => {
      if (userId) {
        io.to(`user_${userId}`).emit('new_chat', chat);
      }
    });
    logger.info(`New chat emitted to users: ${userIds.join(', ')}`);
    return true;
  } catch (error) {
    logger.error('Error emitting new chat:', error);
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

// Emit notification to specific user
const emitNotification = (userId, notification) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!userId || !notification) {
      logger.warn('Invalid parameters for emitNotification');
      return false;
    }
    io.to(`user_${userId}`).emit('notification', notification);
    logger.info(`Notification emitted to user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error emitting notification:', error);
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

// Emit when messages are marked as read
const emitMessagesRead = (chatId, userIds, readData) => {
  try {
    if (!io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }
    if (!chatId || !Array.isArray(userIds) || !readData) {
      logger.warn('Invalid parameters for emitMessagesRead');
      return false;
    }
    userIds.forEach(userId => {
      if (userId) {
        io.to(`user_${userId}`).emit('messages_read', {
          chatId,
          readData,
          timestamp: new Date()
        });
      }
    });
    logger.info(`Messages read event emitted for chat ${chatId}`);
    return true;
  } catch (error) {
    logger.error('Error emitting messages read:', error);
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
  getSocketInstance,
  emitNewMessage,
  emitMessageDeleted,
  emitNewChat,
  emitBookingStatusUpdate,
  emitBookingPaymentUpdate,
  emitBookingEvent,
  emitNotification,
  emitUserNotification,
  emitMessagesRead,
  isUserOnline,
  getOnlineUsersCount,
  getOnlineUsersList,
  disconnectUser
};
