const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.config');

const TimeSlot = sequelize.define('timeslot', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  start_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  end_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  sub_field_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  booking_id: {
    type: DataTypes.UUID
  },
  is_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: false
});

module.exports = TimeSlot; 