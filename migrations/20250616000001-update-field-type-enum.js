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
        WHEN field_type::text = 'indoor' THEN '5vs5'::enum_subfields_field_type
        WHEN field_type::text = 'outdoor' THEN '7vs7'::enum_subfields_field_type
        WHEN field_type::text = 'hybrid' THEN '7vs7'::enum_subfields_field_type
        ELSE '5vs5'::enum_subfields_field_type
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
        WHEN field_type::text = '5vs5' THEN 'indoor'::enum_subfields_field_type
        WHEN field_type::text = '7vs7' THEN 'outdoor'::enum_subfields_field_type
        ELSE 'indoor'::enum_subfields_field_type
      END;
    `);
  }
};
