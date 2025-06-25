'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add status column to replace is_available boolean
    await queryInterface.addColumn('timeslots', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'available',
      validate: {
        isIn: [['available', 'booked', 'maintenance']]
      }
    });

    // Add maintenance-related fields
    await queryInterface.addColumn('timeslots', 'maintenance_reason', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('timeslots', 'maintenance_until', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Migrate existing data from is_available to status
    await queryInterface.sequelize.query(`
      UPDATE timeslots 
      SET status = CASE 
        WHEN is_available = true THEN 'available'
        ELSE 'booked'
      END
    `);

    // Add index for better performance on status queries
    await queryInterface.addIndex('timeslots', {
      fields: ['status', 'sub_field_id', 'date'],
      name: 'timeslot_status_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added columns and index
    await queryInterface.removeIndex('timeslots', 'timeslot_status_index');
    await queryInterface.removeColumn('timeslots', 'maintenance_until');
    await queryInterface.removeColumn('timeslots', 'maintenance_reason');
    await queryInterface.removeColumn('timeslots', 'status');
  }
};
