// Simple socket config for testing
console.log('Loading socket config...');

const { Server } = require('socket.io');
console.log('✓ socket.io loaded');

const jwt = require('jsonwebtoken');
console.log('✓ jwt loaded');

const logger = require('../utils/logger');
console.log('✓ logger loaded');

const { User } = require('../models');
console.log('✓ User model loaded');

const rateLimiter = require('../utils/rateLimiter');
console.log('✓ rateLimiter loaded');

const roomManager = require('../utils/roomManager');
console.log('✓ roomManager loaded');

const messageHistory = require('../utils/messageHistory');
console.log('✓ messageHistory loaded');

let io;

const initializeSocket = (server) => {
  console.log('initializeSocket called');
  return null; // placeholder
};

console.log('Exporting module...');

module.exports = {
  initializeSocket
};

console.log('Module exported successfully');
