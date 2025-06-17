'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Just update existing data to map old values to new ones
    // The enum values 5vs5 and 7vs7 already exist from previous failed attempts
    await queryInterface.sequelize.query(`
      UPDATE subfields 
      SET field_type = CASE 
        WHEN field_type = 'indoor' THEN '5vs5'
        WHEN field_type = 'outdoor' THEN '7vs7'
        WHEN field_type = 'hybrid' THEN '7vs7'
        ELSE field_type
      END;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Revert data mapping
    await queryInterface.sequelize.query(`
      UPDATE subfields 
      SET field_type = CASE 
        WHEN field_type = '5vs5' THEN 'indoor'
        WHEN field_type = '7vs7' THEN 'outdoor'
        ELSE field_type
      END;
    `);
  }
};
