'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Add unique constraint to prevent double booking at database level
      // This ensures that no two timeslots can exist for the same subfield, date, and overlapping time
      await queryInterface.addConstraint('timeslots', {
        fields: ['sub_field_id', 'date', 'start_time', 'end_time'],
        type: 'unique',
        name: 'unique_timeslot_booking'
      });

      console.log('✅ Added unique constraint for timeslot booking prevention');

      // Also add an index to improve query performance for availability checks
      await queryInterface.addIndex('timeslots', {
        fields: ['sub_field_id', 'date', 'start_time', 'end_time', 'is_available'],
        name: 'idx_timeslot_availability_check'
      });

      console.log('✅ Added performance index for availability checks');

    } catch (error) {
      console.error('Error adding timeslot constraints:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove the unique constraint
      await queryInterface.removeConstraint('timeslots', 'unique_timeslot_booking');
      
      // Remove the index
      await queryInterface.removeIndex('timeslots', 'idx_timeslot_availability_check');
      
      console.log('✅ Removed timeslot constraints and indexes');
    } catch (error) {
      console.error('Error removing timeslot constraints:', error);
      throw error;
    }
  }
};
