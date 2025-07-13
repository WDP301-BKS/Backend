const { Chat, Message, User, sequelize } = require("../models");
const { Op } = require("sequelize");
const { errorHandler } = require("../common");
const { NotFoundError, BadRequestError, ForbiddenError } = errorHandler;

class ChatService {
  /**
   * Tìm hoặc tạo chat giữa hai user
   * @param {string} user1Id
   * @param {string} user2Id
   * @returns {Object} chat object
   */
  async findOrCreateChat(user1Id, user2Id) {
    // Kiểm tra user2 có tồn tại không
    const user2 = await User.findByPk(user2Id);
    if (!user2) {
      throw new NotFoundError("Không tìm thấy người dùng");
    }
    // Kiểm tra không thể chat với chính mình
    if (user1Id === user2Id) {
      throw new BadRequestError("Không thể tạo chat với chính mình");
    }
    // Tìm chat đã tồn tại giữa hai user
    let chat = await Chat.findOne({
      where: {
        [Op.or]: [
          { user_id1: user1Id, user_id2: user2Id },
          { user_id1: user2Id, user_id2: user1Id },
        ],
      },
      include: [
        {
          model: User,
          as: "user1",
          attributes: ["id", "name", "email", "profileImage", "role"],
        },
        {
          model: User,
          as: "user2",
          attributes: ["id", "name", "email", "profileImage", "role"],
        },
      ],
    });
    if (chat) {
      return chat;
    }

    const newChat = await Chat.create({
      user_id1: user1Id,
      user_id2: user2Id,
    });
    // Lấy chat với thông tin user
    return await Chat.findByPk(newChat.id, {
      include: [
        {
          model: User,
          as: "user1",
          attributes: ["id", "name", "email", "profileImage", "role"],
        },
        {
          model: User,
          as: "user2",
          attributes: ["id", "name", "email", "profileImage", "role"],
        },
      ],
    });
  }  /**
   * Lấy danh sách chat của user
   * @param {string} userId
   * @returns {Array} danh sách chat
   */
  async getUserChats(userId) {
    const chats = await Chat.findAll({
      where: {
        [Op.or]: [{ user_id1: userId }, { user_id2: userId }],
      },
      include: [
        {
          model: User,
          as: "user1",
          attributes: ["id", "name", "email", "profileImage", "role"],
        },
        {
          model: User,
          as: "user2",
          attributes: ["id", "name", "email", "profileImage", "role"],
        },
        {
          model: Message,
          limit: 1,
          order: [["created_at", "DESC"]],
          attributes: ["id", "content", "sender_id", "created_at", "is_read"],
          include: [
            {
              model: User,
              as: "sender",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Lấy số tin nhắn chưa đọc cho mỗi chat
    const unreadCounts = await this.getUnreadMessagesCountByChat(userId);

    return chats.map((chat) => this.formatChatForList(chat, userId, unreadCounts[chat.id] || 0));
  }

  /**
   * Lấy chi tiết chat với tin nhắn
   * @param {string} chatId
   * @param {string} userId
   * @returns {Object} chi tiết chat
   */
  async getChatDetail(chatId, userId) {
    // Kiểm tra quyền truy cập
    const chat = await this.validateChatAccess(chatId, userId);

    // Lấy tin nhắn
    const messages = await Message.findAll({
      where: { chat_id: chatId },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "profileImage"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    return this.formatChatDetail(chat, messages, userId);
  }

  /**
   * Gửi tin nhắn
   * @param {string} chatId
   * @param {string} senderId
   * @param {string} content
   * @returns {Object} tin nhắn mới
   */
  async sendMessage(chatId, senderId, content) {
    //Validate content
    if (!content || content.trim().length === 0) {
      throw new BadRequestError("Nội dung tin nhắn không được để trống");
    }
    if (content.trim().length > 1000) {
      throw new BadRequestError("Tin nhắn không được vượt quá 1000 ký tự");
    }

    // Kiểm tra quyền truy cập chat
    const chat = await this.validateChatAccess(chatId, senderId);

    // Tạo tin nhắn
    const message = await Message.create({
      content: content.trim(),
      sender_id: senderId,
      chat_id: chatId,
    });

    // Lấy tin nhắn với thông tin sender
    const messageWithSender = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "profileImage"],
        },
      ],
    });

    // Tạo notification cho người nhận
    const otherUserId = chat.user1.id === senderId ? chat.user2.id : chat.user1.id;
    const { createNotification } = require('./notification.service');

    // Kiểm tra notification chưa đọc đã tồn tại cho user nhận, chat này và sender này chưa
    const Notification = require('../models/notification.model');
    const existingNotification = await Notification.findOne({
      where: {
        user_id: otherUserId,
        is_read: false,
        title: 'Tin nhắn mới',
        // Phân biệt theo chatId và senderId để không cộng dồn sai
        message: { [Op.like]: `%chat:${chatId}%sender:${senderId}%` },
      },
      order: [['created_at', 'DESC']],
    });

    const { emitNewNotification } = require('../config/socket.config');
    let notification;
    if (existingNotification) {
      // Đếm lại số tin nhắn chưa đọc từ senderId tới otherUserId trong chat này
      const unreadCount = await Message.count({
        where: {
          chat_id: chatId,
          sender_id: senderId,
          is_read: false,
        },
      });
      // Cập nhật message notification hiện tại
      existingNotification.message = `Bạn có ${unreadCount > 0 ? unreadCount : 1} tin nhắn mới từ ${messageWithSender.sender?.name || 'người dùng'} (chat:${chatId} sender:${senderId})`;
      await existingNotification.save();
      notification = existingNotification;
    } else {
      // Tạo notification mới, nhúng chatId và senderId vào message để phân biệt
      notification = await createNotification(
        otherUserId,
        'Tin nhắn mới',
        `Bạn có 1 tin nhắn mới từ ${messageWithSender.sender?.name || 'người dùng'} (chat:${chatId} sender:${senderId})`
      );
    }
    // Emit socket notification realtime cho user nhận
    if (emitNewNotification) {
      emitNewNotification([otherUserId], notification);
    }

    return this.formatMessage(messageWithSender, senderId);
  }

  /**
   * Xóa tin nhắn
   * @param {string} messageId
   * @param {string} userId
   */
  async deleteMessage(messageId, userId) {
    const message = await Message.findByPk(messageId);

    if (!message) {
      throw new NotFoundError("Tin nhắn không tồn tại");
    }

    if (message.sender_id !== userId) {
      throw new ForbiddenError("Bạn không có quyền xóa tin nhắn này");
    }

    await message.destroy();
  }
  /**
   * Lấy thông tin tin nhắn
   * @param {string} messageId
   * @returns {Object} message info
   */
  async getMessageInfo(messageId) {
    const message = await Message.findByPk(messageId, {
      attributes: ["id", "chat_id", "sender_id"],
    });

    if (!message) {
      throw new NotFoundError("Tin nhắn không tồn tại");
    }

    return {
      id: message.id,
      chatId: message.chat_id,
      senderId: message.sender_id,
    };
  }
  /**
   * Kiểm tra quyền truy cập chat
   * @param {string} chatId
   * @param {string} userId
   * @returns {Object} chat object
   */
  async validateChatAccess(chatId, userId) {
    const chat = await Chat.findOne({
      where: {
        id: chatId,
        [Op.or]: [{ user_id1: userId }, { user_id2: userId }],
      },
      include: [
        {
          model: User,
          as: "user1",
          attributes: ["id", "name", "email", "profileImage", "role"],
        },
        {
          model: User,
          as: "user2",
          attributes: ["id", "name", "email", "profileImage", "role"],
        },
      ],
    });

    if (!chat) {
      throw new NotFoundError(
        "Chat không tồn tại hoặc bạn không có quyền truy cập"
      );
    }

    return chat;
  }  /**
   * Format chat cho danh sách
   */
  formatChatForList(chat, currentUserId, unreadCount = 0) {
    const otherUser = chat.user1.id === currentUserId ? chat.user2 : chat.user1;
    const lastMessage =
      chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;

    // Import socket functions to check online status
    const { isUserOnline } = require('../config/socket.config');

    return {
      id: chat.id,
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        email: otherUser.email,
        profileImage: otherUser.profileImage,
        role: otherUser.role,
        isOnline: isUserOnline(otherUser.id),
      },
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.sender_id,
            senderName: lastMessage.sender?.name,
            createdAt: lastMessage.created_at,
            isFromMe: lastMessage.sender_id === currentUserId,
            isRead: lastMessage.is_read,
          }
        : null,
      unreadCount: unreadCount,
      createdAt: chat.created_at,
    };
  }
  /**
   * Format chi tiết chat
   */
  formatChatDetail(chat, messages, currentUserId) {
    const otherUser = chat.user1.id === currentUserId ? chat.user2 : chat.user1;

    // Import socket functions to check online status
    const { isUserOnline } = require('../config/socket.config');

    return {
      id: chat.id,
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        email: otherUser.email,
        profileImage: otherUser.profileImage,
        role: otherUser.role,
        isOnline: isUserOnline(otherUser.id),
      },
      messages: messages.map((message) =>
        this.formatMessage(message, currentUserId)
      ),
      createdAt: chat.created_at,
    };
  }/**
   * Format tin nhắn
   */
  formatMessage(message, currentUserId) {
    return {
      id: message.id,
      content: message.content,
      senderId: message.sender_id,
      chatId: message.chat_id,
      sender: message.sender ? {
        id: message.sender.id,
        name: message.sender.name,
        profileImage: message.sender.profileImage,
      } : null,
      isFromMe: message.sender_id === currentUserId,
      isRead: message.is_read,
      readAt: message.read_at,
      createdAt: message.created_at,
    };
  }
  /**
   * Đánh dấu tin nhắn đã đọc
   * @param {string} chatId
   * @param {string} userId
   * @returns {Object} result với chatParticipants
   */
  async markMessagesAsRead(chatId, userId) {
    // Kiểm tra quyền truy cập chat
    const chat = await this.validateChatAccess(chatId, userId);

    // Đánh dấu tất cả tin nhắn chưa đọc của người khác là đã đọc
    await Message.update(
      {
        is_read: true,
        read_at: new Date(),
      },
      {
        where: {
          chat_id: chatId,
          sender_id: { [Op.ne]: userId },
          is_read: false,
        },
      }
    );

    // Trả về danh sách participants của chat
    return {
      chatParticipants: [chat.user_id1, chat.user_id2]
    };
  }

  /**
   * Lấy số tin nhắn chưa đọc của user
   * @param {string} userId
   * @returns {number} số tin nhắn chưa đọc
   */
  async getUnreadMessagesCount(userId) {
    const count = await Message.count({
      include: [
        {
          model: Chat,
          where: {
            [Op.or]: [{ user_id1: userId }, { user_id2: userId }],
          },
        },
      ],
      where: {
        sender_id: { [Op.ne]: userId },
        is_read: false,
      },
    });

    return count;
  }

  /**
   * Lấy số tin nhắn chưa đọc theo từng chat
   * @param {string} userId
   * @returns {Object} object với key là chatId và value là số tin nhắn chưa đọc
   */  async getUnreadMessagesCountByChat(userId) {
    const results = await Message.findAll({
      attributes: [
        "chat_id",
        [sequelize.fn("COUNT", sequelize.col("message.id")), "unread_count"],
      ],
      include: [
        {
          model: Chat,
          where: {
            [Op.or]: [{ user_id1: userId }, { user_id2: userId }],
          },
          attributes: [],
        },
      ],
      where: {
        sender_id: { [Op.ne]: userId },
        is_read: false,
      },
      group: ["chat_id"],
      raw: true,
    });

    const unreadCounts = {};
    results.forEach((result) => {
      unreadCounts[result.chat_id] = parseInt(result.unread_count);
    });

    return unreadCounts;
  }
}

module.exports = new ChatService();
