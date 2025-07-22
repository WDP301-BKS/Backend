const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

// Database configuration
const dbName = process.env.DB_NAME ;
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'password';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 5432;

// SSL configuration for production
const isProduction = process.env.NODE_ENV === 'production';
const sslConfig = isProduction ? {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
} : {};

// Initialize main Sequelize connection
const sequelize = new Sequelize(
  process.env.DATABASE_URL || `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`,
  {
    dialect: 'postgres',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: false,
    ...(isProduction && {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    })
  }
);

// Function to create database if it doesn't exist
const createDatabaseIfNotExists = async () => {
  // Connect to postgres database initially
  const pool = new Pool({
    user: dbUser,
    host: dbHost,
    password: dbPassword,
    port: dbPort,
    database: 'postgres', // Connect to default postgres database
    ...sslConfig
  });

  try {
    // Check if our database exists
    const checkDbResult = await pool.query(
      `SELECT FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    // If database doesn't exist, create it
    if (checkDbResult.rowCount === 0) {
      console.log(`Database "${dbName}" not found, creating it now...`);
      await pool.query(`CREATE DATABASE "${dbName}";`);
      console.log(`Database "${dbName}" created successfully`);
    } else {
      console.log(`Database "${dbName}" already exists`);
    }
  } catch (error) {
    console.error('Error creating database:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

// Test and initialize database connection
const testDbConnection = async () => {
  try {
    // In production, skip database creation (Render manages this)
    if (!isProduction) {
      // Only try to create database in development
      await createDatabaseIfNotExists();
    }
    
    // Test connection to our database
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  testDbConnection,
  createDatabaseIfNotExists
}; 