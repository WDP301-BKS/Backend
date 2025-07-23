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

// Fallback connection string if DATABASE_URL is not set
const fallbackConnectionString = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

console.log('Database configuration check:');
console.log('- DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('- DB_HOST:', dbHost || 'Not set');
console.log('- DB_USER:', dbUser || 'Not set');
console.log('- DB_PASSWORD:', dbPassword ? 'Set' : 'Not set');

// Always use SSL for Supabase connections
const sslConfig = {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
};

// Initialize main Sequelize connection with Supabase
const databaseUrl = process.env.DATABASE_URL || fallbackConnectionString;

if (!process.env.DATABASE_URL && (!dbHost || !dbPassword)) {
  console.error('❌ Missing required database configuration!');
  console.error('Either set DATABASE_URL or provide DB_HOST, DB_USER, DB_PASSWORD');
  process.exit(1);
}

const sequelize = new Sequelize(databaseUrl, {
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