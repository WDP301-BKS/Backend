'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('timeslots', 'payment_pending');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('timeslots', 'payment_pending', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indicates if this time slot is temporarily reserved while payment is pending'
    });
  }
};
