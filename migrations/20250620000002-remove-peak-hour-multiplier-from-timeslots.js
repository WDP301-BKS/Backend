'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove peak_hour_multiplier column from timeslots table
    await queryInterface.removeColumn('timeslots', 'peak_hour_multiplier');
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add peak_hour_multiplier column if rollback is needed
    await queryInterface.addColumn('timeslots', 'peak_hour_multiplier', {
      type: Sequelize.DECIMAL(3, 2),
      defaultValue: 1.0,
      allowNull: false
    });
  }
};
