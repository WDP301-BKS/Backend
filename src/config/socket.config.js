const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { User } = require('../models');
const rateLimiter = require('../utils/rateLimiter');
const roomManager = require('../utils/roomManager');
const messageHistory = require('../utils/messageHistory');

let io;

//Khởi tạo Socket.IO server
const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      logger.info('JWT decoded payload:', decoded);
      
      // Get user info - the JWT payload has 'id' not 'userId'
      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'name', 'email', 'role', 'profileImage']
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user.id;
      socket.user = user;
      
      logger.info(`User ${user.name} (${user.id}) connected via socket`);
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });
  // Connection event
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} for user: ${socket.userId}`);    // Join user to their personal room
    socket.join(`user_${socket.userId}`);
    logger.info(`User ${socket.userId} joined personal room: user_${socket.userId}`);
    
    // Broadcast user online status to others
    socket.broadcast.emit('user_status_change', {
      userId: socket.userId,
      status: 'online'
    });
    
    logger.info(`User ${socket.userId} is now online`);// Handle joining chat rooms
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
        });        // Mark messages as read
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
    });    // Handle leaving chat rooms
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
    });    // Handle typing events
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
          userName: socket.user.name,
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
    });    // Handle online status
    socket.on('user_online', () => {
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        status: 'online'
      });
    });    // Handle offline status
    socket.on('user_offline', () => {
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: new Date().toISOString()
      });
    });

    // Handle update online status
    socket.on('update_online_status', (data) => {
      try {
        const { isOnline } = data;
        
        socket.broadcast.emit('user_status_change', {
          userId: socket.userId,
          status: isOnline ? 'online' : 'offline',
          lastSeen: isOnline ? null : new Date().toISOString()
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
        const isOnline = isUserOnline(userId);
        
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

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} for user: ${socket.userId}`);
      
      // Broadcast user offline status
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: new Date().toISOString()
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
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
        }        // Mark messages as read
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
        }socket.emit('messages_marked_read', {
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
  });

  return io;
};

//Get Socket.IO instance
const getSocketInstance = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};

//Emit new message to chat participants
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

//Emit message deleted to chat participants
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

//Emit new chat created to users
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
      if (userId) {        io.to(`user_${userId}`).emit('messages_read', {
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

// Get online users count
const getOnlineUsersCount = () => {
  if (io) {
    return io.sockets.sockets.size;
  }
  return 0;
};

// Check if user is online
const isUserOnline = (userId) => {
  if (io) {
    const room = io.sockets.adapter.rooms.get(`user_${userId}`);
    return room && room.size > 0;
  }
  return false;
};

module.exports = {
  initializeSocket,
  getSocketInstance,
  emitNewMessage,
  emitMessageDeleted,
  emitNewChat,
  emitNotification,
  emitMessagesRead,
  getOnlineUsersCount,
  isUserOnline
};
