'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, we need to drop the existing enum constraint and recreate it
    await queryInterface.sequelize.query(`
      ALTER TABLE subfields 
      DROP CONSTRAINT IF EXISTS subfields_field_type_check;
    `);
    
    // Add the new enum constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE subfields 
      ADD CONSTRAINT subfields_field_type_check 
      CHECK (field_type IN ('5vs5', '7vs7'));
    `);
    
    // Update existing data - you may want to map old values to new ones
    // For example: indoor -> 5vs5, outdoor -> 7vs7, hybrid -> 7vs7
    await queryInterface.sequelize.query(`
      UPDATE subfields 
      SET field_type = CASE 
        WHEN field_type = 'indoor' THEN '5vs5'
        WHEN field_type = 'outdoor' THEN '7vs7'
        WHEN field_type = 'hybrid' THEN '7vs7'
        ELSE '5vs5'
      END;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to old enum values
    await queryInterface.sequelize.query(`
      ALTER TABLE subfields 
      DROP CONSTRAINT IF EXISTS subfields_field_type_check;
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE subfields 
      ADD CONSTRAINT subfields_field_type_check 
      CHECK (field_type IN ('indoor', 'outdoor', 'hybrid'));
    `);
    
    // Revert data mapping
    await queryInterface.sequelize.query(`
      UPDATE subfields 
      SET field_type = CASE 
        WHEN field_type = '5vs5' THEN 'indoor'
        WHEN field_type = '7vs7' THEN 'outdoor'
        ELSE 'indoor'
      END;
    `);
  }
};
