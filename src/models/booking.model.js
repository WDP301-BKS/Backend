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
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
    defaultValue: 'pending'
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'pending'
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = Booking; 