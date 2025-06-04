const { Message, User } = require('../models');
const logger = require('../utils/logger');

class MessageHistoryService {
  /**
   * Get recent messages for a chat when user joins
   * @param {string} chatId 
   * @param {number} limit 
   * @returns {Array}
   */
  async getRecentMessages(chatId, limit = 50) {
    try {
      const messages = await Message.findAll({
        where: {
          chat_id: chatId
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'name', 'profileImage']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: limit
      });

      // Reverse to get chronological order (oldest first)
      return messages.reverse().map(message => ({
        id: message.id,
        content: message.content,
        senderId: message.sender_id,
        chatId: message.chat_id,
        isRead: message.is_read,
        readAt: message.read_at,
        createdAt: message.created_at,
        sender: message.sender
      }));
    } catch (error) {
      logger.error('Error getting recent messages:', error);
      return [];
    }
  }

  /**
   * Get messages with pagination
   * @param {string} chatId 
   * @param {number} page 
   * @param {number} limit 
   * @param {string} beforeMessageId - Get messages before this message ID
   * @returns {Object}
   */
  async getMessagesWithPagination(chatId, page = 1, limit = 20, beforeMessageId = null) {
    try {
      let whereClause = { chat_id: chatId };
      
      // If beforeMessageId is provided, get messages before that message
      if (beforeMessageId) {
        const beforeMessage = await Message.findByPk(beforeMessageId);
        if (beforeMessage) {
          whereClause.created_at = {
            [require('sequelize').Op.lt]: beforeMessage.created_at
          };
        }
      }

      const offset = (page - 1) * limit;

      const { count, rows: messages } = await Message.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'name', 'profileImage']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: limit,
        offset: offset
      });

      // Reverse to get chronological order (oldest first)
      const formattedMessages = messages.reverse().map(message => ({
        id: message.id,
        content: message.content,
        senderId: message.sender_id,
        chatId: message.chat_id,
        isRead: message.is_read,
        readAt: message.read_at,
        createdAt: message.created_at,
        sender: message.sender
      }));

      return {
        messages: formattedMessages,
        pagination: {
          total: count,
          page: page,
          limit: limit,
          totalPages: Math.ceil(count / limit),
          hasMore: count > (page * limit)
        }
      };
    } catch (error) {
      logger.error('Error getting messages with pagination:', error);
      return {
        messages: [],
        pagination: {
          total: 0,
          page: page,
          limit: limit,
          totalPages: 0,
          hasMore: false
        }
      };
    }
  }

  /**
   * Mark messages as read
   * @param {string} chatId 
   * @param {string} userId 
   * @returns {number} Number of messages marked as read
   */
  async markMessagesAsRead(chatId, userId) {
    try {
      const [updatedCount] = await Message.update(
        { 
          is_read: true, 
          read_at: new Date() 
        },
        {
          where: {
            chat_id: chatId,
            sender_id: { [require('sequelize').Op.ne]: userId }, // Don't mark own messages as read
            is_read: false
          }
        }
      );

      logger.info(`Marked ${updatedCount} messages as read for user ${userId} in chat ${chatId}`);
      return updatedCount;
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      return 0;
    }
  }

  /**
   * Get unread message count for a chat
   * @param {string} chatId 
   * @param {string} userId 
   * @returns {number}
   */
  async getUnreadCount(chatId, userId) {
    try {
      const count = await Message.count({
        where: {
          chat_id: chatId,
          sender_id: { [require('sequelize').Op.ne]: userId },
          is_read: false
        }
      });

      return count;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      return 0;
    }
  }
}

module.exports = new MessageHistoryService();
