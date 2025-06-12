'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if column exists before adding
    const tableDescription = await queryInterface.describeTable('bookings');
    
    if (!tableDescription.payment_due_date) {
      await queryInterface.addColumn('bookings', 'payment_due_date', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Due date for payment completion'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('bookings', 'payment_due_date');
  }
};
