const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');
const { errorHandler } = require('./common');
const { globalErrorHandler } = errorHandler;
const logger = require('./utils/logger');
const requestLoggerMiddleware = require('./middlewares/requestLogger');
const requestIdMiddleware = require('./middlewares/requestId');
const responseFormatter = require('./utils/responseFormatter');
const { initializeSocket } = require('./config/socket.config');

// Load environment variables
dotenv.config();

// Import DB and models
const { sequelize, testDbConnection, syncModels } = require('./models');

// Import routes
const routes = require('./routes');

// Initialize express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  exposedHeaders: ['x-correlation-id'],
  credentials: true
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Middleware - but exclude webhook route from JSON parsing
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add correlation ID to every request
app.use(requestIdMiddleware);

// Request logging middleware
app.use(requestLoggerMiddleware);

// Routes
app.use('/api', routes);

// Default route
app.get('/', (req, res) => {
  res.json(responseFormatter.success({ message: 'Welcome to Football Field Booking API.' }));
});

// Handle 404
app.use((req, res) => {
  res.status(404).json(
    responseFormatter.error(`Route ${req.originalUrl} not found`, 404)
  );
  logger.warn(`404 - Route not found: ${req.originalUrl}`, { correlationId: req.correlationId });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { 
    correlationId: req.correlationId,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  // Format the error response
  const statusCode = err.statusCode || 500;
  const errorResponse = responseFormatter.error(
    err.message || 'Internal Server Error',
    statusCode,
    err.errors
  );
  
  res.status(statusCode).json(errorResponse);
});

// Server setup
const PORT = process.env.PORT || 5001;

// Test DB connection and sync models
const startServer = async () => {
  try {
    // Test the database connection
    await testDbConnection();
    logger.info('Database connection successful');
    
    // Sync all models with the database
    await syncModels();
    logger.info('Models synchronized with database');
    
    // Start periodic cleanup for expired bookings
    const dbOptimizer = require('./utils/dbOptimizer');
    const cleanupInterval = dbOptimizer.startPeriodicCleanup();
    logger.info('Started periodic cleanup for expired bookings');
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      clearInterval(cleanupInterval);
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      clearInterval(cleanupInterval);
      process.exit(0);
    });
    
    // Start the server
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Socket.IO server initialized`);
      logger.info(`CORS enabled for: ${process.env.FRONTEND_URL}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
  }
};

startServer();