const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

// Database configuration for Supabase
const dbName = process.env.DB_NAME || 'postgres';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT || 5432;

// Always use SSL for Supabase connections
const sslConfig = {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
};

// Initialize main Sequelize connection with Supabase
const sequelize = new Sequelize(
  process.env.DATABASE_URL,
  {
    dialect: 'postgres',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
);

// Test and initialize database connection for Supabase
const testDbConnection = async () => {
  try {
    // Test connection to Supabase database
    await sequelize.authenticate();
    console.log('Supabase database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to Supabase database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  testDbConnection
}; 