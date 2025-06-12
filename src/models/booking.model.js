const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.config');

const Booking = sequelize.define('booking', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  booking_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed', 'payment_pending'),
    defaultValue: 'pending'
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded', 'processing'),
    defaultValue: 'pending'
  },
  payment_due_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false // Now required for all bookings
  },
  customer_info: {
    type: DataTypes.JSON // Store customer details
  },
  booking_metadata: {
    type: DataTypes.JSON // Store additional booking info
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Booking; 