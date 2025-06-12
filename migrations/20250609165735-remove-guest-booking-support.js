'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // First, remove any existing guest bookings (bookings with null user_id)
    await queryInterface.sequelize.query(`
      DELETE FROM timeslots WHERE booking_id IN (
        SELECT id FROM bookings WHERE user_id IS NULL
      )
    `);
    
    await queryInterface.sequelize.query(`
      DELETE FROM bookings WHERE user_id IS NULL
    `);
    
    // Then make user_id NOT NULL
    await queryInterface.changeColumn('bookings', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false
    });
  },

  async down (queryInterface, Sequelize) {
    // Revert user_id to allow NULL values (restore guest booking support)
    await queryInterface.changeColumn('bookings', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true
    });
  }
};
