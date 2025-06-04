const logger = require('./logger');

class SocketRateLimiter {
  constructor() {
    // Store rate limit data for each user
    this.userLimits = new Map();
    
    // Configuration for different event types
    this.limits = {
      'join_chat': { maxRequests: 10, window: 60000 }, // 10 requests per minute
      'leave_chat': { maxRequests: 10, window: 60000 },
      'typing_start': { maxRequests: 30, window: 60000 }, // 30 requests per minute
      'typing_stop': { maxRequests: 30, window: 60000 },
      'send_message': { maxRequests: 20, window: 60000 }, // 20 messages per minute
      'default': { maxRequests: 50, window: 60000 } // Default limit
    };
    
    // Clean up old entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if user can perform the event
   * @param {string} userId 
   * @param {string} eventName 
   * @returns {boolean}
   */
  checkLimit(userId, eventName) {
    const now = Date.now();
    const limit = this.limits[eventName] || this.limits.default;
    
    if (!this.userLimits.has(userId)) {
      this.userLimits.set(userId, new Map());
    }
    
    const userEvents = this.userLimits.get(userId);
    
    if (!userEvents.has(eventName)) {
      userEvents.set(eventName, {
        count: 0,
        windowStart: now
      });
    }
    
    const eventData = userEvents.get(eventName);
    
    // Reset window if expired
    if (now - eventData.windowStart > limit.window) {
      eventData.count = 0;
      eventData.windowStart = now;
    }
    
    // Check if limit exceeded
    if (eventData.count >= limit.maxRequests) {
      logger.warn(`Rate limit exceeded for user ${userId} on event ${eventName}`);
      return false;
    }
    
    // Increment counter
    eventData.count++;
    return true;
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(this.limits).map(l => l.window));
    
    for (const [userId, userEvents] of this.userLimits.entries()) {
      for (const [eventName, eventData] of userEvents.entries()) {
        if (now - eventData.windowStart > maxWindow) {
          userEvents.delete(eventName);
        }
      }
      
      if (userEvents.size === 0) {
        this.userLimits.delete(userId);
      }
    }
  }

  /**
   * Get remaining requests for a user and event
   * @param {string} userId 
   * @param {string} eventName 
   * @returns {number}
   */
  getRemainingRequests(userId, eventName) {
    const limit = this.limits[eventName] || this.limits.default;
    const userEvents = this.userLimits.get(userId);
    
    if (!userEvents || !userEvents.has(eventName)) {
      return limit.maxRequests;
    }
    
    const eventData = userEvents.get(eventName);
    const now = Date.now();
    
    // Reset if window expired
    if (now - eventData.windowStart > limit.window) {
      return limit.maxRequests;
    }
    
    return Math.max(0, limit.maxRequests - eventData.count);
  }
}

module.exports = new SocketRateLimiter();
