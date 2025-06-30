'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop existing indexes that use is_available
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS "unique_booked_timeslot";',
        { transaction }
      );
      
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS "timeslot_availability_index";',
        { transaction }
      );
      
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS "idx_timeslot_availability_check";',
        { transaction }
      );
      
      // Remove the is_available column
      await queryInterface.removeColumn('timeslots', 'is_available', { transaction });
      
      // Create new indexes based on status
      await queryInterface.addIndex('timeslots', {
        unique: true,
        fields: ['sub_field_id', 'date', 'start_time', 'end_time'],
        where: {
          status: {
            [Sequelize.Op.ne]: 'available'
          }
        },
        name: 'unique_booked_timeslot',
        transaction
      });
      
      await queryInterface.addIndex('timeslots', {
        fields: ['sub_field_id', 'date', 'status'],
        name: 'timeslot_availability_index',
        transaction
      });
      
      // Recreate the availability check index with status instead of is_available
      await queryInterface.addIndex('timeslots', {
        fields: ['sub_field_id', 'date', 'start_time', 'end_time', 'status'],
        name: 'idx_timeslot_availability_check',
        transaction
      });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add back the is_available column
      await queryInterface.addColumn('timeslots', 'is_available', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }, { transaction });
      
      // Update is_available based on status
      await queryInterface.sequelize.query(
        `UPDATE timeslots SET is_available = CASE 
          WHEN status = 'available' THEN true 
          ELSE false 
        END`,
        { transaction }
      );
      
      // Drop new indexes
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS "unique_booked_timeslot";',
        { transaction }
      );
      
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS "timeslot_availability_index";',
        { transaction }
      );
      
      // Recreate old indexes
      await queryInterface.addIndex('timeslots', {
        unique: true,
        fields: ['sub_field_id', 'date', 'start_time', 'end_time'],
        where: {
          is_available: false
        },
        name: 'unique_booked_timeslot',
        transaction
      });
      
      await queryInterface.addIndex('timeslots', {
        fields: ['sub_field_id', 'date', 'is_available'],
        name: 'timeslot_availability_index',
        transaction
      });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
