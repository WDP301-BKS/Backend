const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { errorHandler } = require('./common');
const { globalErrorHandler } = errorHandler;

// Load environment variables
dotenv.config();

// Import DB and models
const { sequelize, testDbConnection, syncModels } = require('./models');

// Import routes
const routes = require('./routes');

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Football Field Booking API.' });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found' 
  });
});

// Global error handler
app.use(globalErrorHandler);

// Server setup
const PORT = process.env.PORT || 5000;

// Test DB connection and sync models
const startServer = async () => {
  try {
    // Test the database connection
    await testDbConnection();
    
    // Sync all models with the database
    await syncModels();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer(); 