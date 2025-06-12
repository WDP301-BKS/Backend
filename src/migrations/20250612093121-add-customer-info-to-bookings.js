'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if column exists before adding
    const tableDescription = await queryInterface.describeTable('bookings');
    
    if (!tableDescription.customer_info) {
      await queryInterface.addColumn('bookings', 'customer_info', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Customer information for the booking'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // Check if column exists before removing
    const tableDescription = await queryInterface.describeTable('bookings');
    
    if (tableDescription.customer_info) {
      await queryInterface.removeColumn('bookings', 'customer_info');
    }
  }
};
