const { Chat, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class RoomManager {
  /**
   * Check if user has permission to join a chat room
   * @param {string} userId 
   * @param {string} chatId 
   * @returns {boolean}
   */
  async canUserJoinChat(userId, chatId) {
    try {
      // Find the chat and check if user is a participant
      const chat = await Chat.findOne({
        where: {
          id: chatId,
          [Op.or]: [
            { user_id1: userId },
            { user_id2: userId }
          ]
        }
      });

      if (!chat) {
        logger.warn(`User ${userId} attempted to join unauthorized chat ${chatId}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking chat permissions:', error);
      return false;
    }
  }

  /**
   * Get chat participants
   * @param {string} chatId 
   * @returns {Array}
   */
  async getChatParticipants(chatId) {
    try {
      const chat = await Chat.findByPk(chatId, {
        include: [
          {
            model: User,
            as: 'user1',
            attributes: ['id', 'name', 'email', 'profileImage']
          },
          {
            model: User,
            as: 'user2',
            attributes: ['id', 'name', 'email', 'profileImage']
          }
        ]
      });

      if (!chat) {
        return [];
      }

      return [chat.user1, chat.user2];
    } catch (error) {
      logger.error('Error getting chat participants:', error);
      return [];
    }
  }

  /**
   * Check if user is participant of the chat
   * @param {string} userId 
   * @param {string} chatId 
   * @returns {boolean}
   */
  async isUserParticipant(userId, chatId) {
    try {
      const chat = await Chat.findOne({
        where: {
          id: chatId,
          [Op.or]: [
            { user_id1: userId },
            { user_id2: userId }
          ]
        }
      });

      return !!chat;
    } catch (error) {
      logger.error('Error checking user participation:', error);
      return false;
    }
  }

  /**
   * Get all chats for a user
   * @param {string} userId 
   * @returns {Array}
   */
  async getUserChats(userId) {
    try {
      const chats = await Chat.findAll({
        where: {
          [Op.or]: [
            { user_id1: userId },
            { user_id2: userId }
          ]
        },
        include: [
          {
            model: User,
            as: 'user1',
            attributes: ['id', 'name', 'email', 'profileImage']
          },
          {
            model: User,
            as: 'user2',
            attributes: ['id', 'name', 'email', 'profileImage']
          }
        ]
      });

      return chats;
    } catch (error) {
      logger.error('Error getting user chats:', error);
      return [];
    }
  }

  /**
   * Get chat by ID
   * @param {string} chatId 
   * @returns {Object|null}
   */
  async getChat(chatId) {
    try {
      const chat = await Chat.findByPk(chatId);
      return chat;
    } catch (error) {
      logger.error('Error getting chat:', error);
      return null;
    }
  }
}

module.exports = new RoomManager();
