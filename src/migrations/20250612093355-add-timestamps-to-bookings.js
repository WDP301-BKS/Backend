'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if columns exist before adding
    const tableDescription = await queryInterface.describeTable('bookings');
    
    if (!tableDescription.created_at) {
      await queryInterface.addColumn('bookings', 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      });
    }
    
    if (!tableDescription.updated_at) {
      await queryInterface.addColumn('bookings', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // Check if columns exist before removing
    const tableDescription = await queryInterface.describeTable('bookings');
    
    if (tableDescription.created_at) {
      await queryInterface.removeColumn('bookings', 'created_at');
    }
    
    if (tableDescription.updated_at) {
      await queryInterface.removeColumn('bookings', 'updated_at');
    }
  }
};
