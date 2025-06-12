/**
 * In-memory message history manager
 * Stores recent messages for each chat room
 */

class MessageHistoryManager {
  constructor(maxMessagesPerRoom = 50) {
    this.history = new Map();
    this.maxMessagesPerRoom = maxMessagesPerRoom;
  }

  /**
   * Add message to room history
   * @param {string} roomName - Room identifier
   * @param {object} message - Message object
   */
  addMessage(roomName, message) {
    if (!this.history.has(roomName)) {
      this.history.set(roomName, []);
    }
    
    const roomHistory = this.history.get(roomName);
    
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = new Date();
    }
    
    // Add to history
    roomHistory.push(message);
    
    // Trim history if necessary
    if (roomHistory.length > this.maxMessagesPerRoom) {
      roomHistory.shift();
    }
    
    return roomHistory.length;
  }

  /**
   * Get message history for a room
   * @param {string} roomName - Room identifier
   * @param {number} limit - Maximum number of messages to return
   * @returns {Array} Array of messages
   */
  getHistory(roomName, limit = this.maxMessagesPerRoom) {
    const roomHistory = this.history.get(roomName) || [];
    
    if (limit && limit < roomHistory.length) {
      return roomHistory.slice(-limit);
    }
    
    return [...roomHistory];
  }

  /**
   * Clear history for a room
   * @param {string} roomName - Room identifier
   */
  clearHistory(roomName) {
    this.history.delete(roomName);
  }

  /**
   * Get all message history
   * @returns {Map} Map of all message history
   */
  getAllHistory() {
    return this.history;
  }
  
  /**
   * Save booking status update message
   * @param {string} bookingId - Booking ID
   * @param {object} statusData - Status data
   */
  saveBookingStatusUpdate(bookingId, statusData) {
    const roomName = `booking:${bookingId}`;
    
    const message = {
      type: 'status_update',
      bookingId,
      ...statusData,
      timestamp: new Date()
    };
    
    return this.addMessage(roomName, message);
  }
  
  /**
   * Get booking status history
   * @param {string} bookingId - Booking ID
   * @returns {Array} Array of status updates
   */
  getBookingStatusHistory(bookingId) {
    const roomName = `booking:${bookingId}`;
    return this.getHistory(roomName);
  }
}

module.exports = new MessageHistoryManager();
