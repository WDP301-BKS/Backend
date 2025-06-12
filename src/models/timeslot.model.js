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
  timestamps: false,
  indexes: [
    {
      // Unique constraint to prevent double booking
      unique: true,
      fields: ['sub_field_id', 'date', 'start_time', 'end_time'],
      where: {
        is_available: false
      },
      name: 'unique_booked_timeslot'
    },
    {
      // Performance index for availability queries
      fields: ['sub_field_id', 'date', 'is_available'],
      name: 'timeslot_availability_index'
    }
  ]
});

module.exports = TimeSlot; 