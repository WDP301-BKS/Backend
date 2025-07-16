'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add columns for owner booking functionality
    await queryInterface.addColumn('bookings', 'is_owner_booking', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Indicates if this booking was created by the field owner on behalf of a customer'
    });

    await queryInterface.addColumn('bookings', 'created_by_owner', {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Owner ID who created this booking (if is_owner_booking is true)'
    });

    await queryInterface.addColumn('bookings', 'remaining_amount', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Remaining amount to be paid'
    });

    await queryInterface.addColumn('bookings', 'notes', {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes for the booking'
    });

    // Modify user_id to allow NULL for owner bookings
    await queryInterface.changeColumn('bookings', 'user_id', {
      type: DataTypes.UUID,
      allowNull: true // Changed to allow null for owner bookings
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('bookings', 'is_owner_booking');
    await queryInterface.removeColumn('bookings', 'created_by_owner');
    await queryInterface.removeColumn('bookings', 'remaining_amount');
    await queryInterface.removeColumn('bookings', 'notes');
    
    // Revert user_id back to NOT NULL
    await queryInterface.changeColumn('bookings', 'user_id', {
      type: DataTypes.UUID,
      allowNull: false
    });
  }
};
