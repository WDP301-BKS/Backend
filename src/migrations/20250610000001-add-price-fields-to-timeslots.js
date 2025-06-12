'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {  async up(queryInterface, Sequelize) {
    // Check if column exists before adding
    const tableDescription = await queryInterface.describeTable('timeslots');
    
    if (!tableDescription.peak_hour_multiplier) {
      await queryInterface.addColumn('timeslots', 'peak_hour_multiplier', {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 1.0
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('timeslots', 'peak_hour_multiplier');
  }
};
