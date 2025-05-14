const User = require('./user.model');
const { sequelize, testDbConnection } = require('../config/db.config');

// Function to sync all models with the database
const syncModels = async () => {
  try {
    await sequelize.sync();
    console.log('All models were synchronized successfully.');
  } catch (error) {
    console.error('Failed to sync models:', error);
  }
};

module.exports = {
  User,
  sequelize,
  testDbConnection,
  syncModels
}; 