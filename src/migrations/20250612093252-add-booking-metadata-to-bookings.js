'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if column exists before adding
    const tableDescription = await queryInterface.describeTable('bookings');
    
    if (!tableDescription.booking_metadata) {
      await queryInterface.addColumn('bookings', 'booking_metadata', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional booking metadata like field info, time slots, etc.'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // Check if column exists before removing
    const tableDescription = await queryInterface.describeTable('bookings');
    
    if (tableDescription.booking_metadata) {
      await queryInterface.removeColumn('bookings', 'booking_metadata');
    }
  }
};
