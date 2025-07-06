'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns
    await queryInterface.addColumn('locations', 'formatted_address', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Formatted address from geocoding service'
    });

    await queryInterface.addColumn('locations', 'country', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('locations', 'country_code', {
      type: Sequelize.STRING(2),
      allowNull: true
    });

    // Update latitude and longitude constraints
    await queryInterface.changeColumn('locations', 'latitude', {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
      validate: {
        min: -90,
        max: 90
      }
    });

    await queryInterface.changeColumn('locations', 'longitude', {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
      validate: {
        min: -180,
        max: 180
      }
    });

    // Make address_text required
    await queryInterface.changeColumn('locations', 'address_text', {
      type: Sequelize.STRING,
      allowNull: false
    });    // Add indexes for better performance (ignore if already exists)
    try {
      await queryInterface.addIndex('locations', ['latitude', 'longitude'], {
        name: 'location_coordinates_idx'
      });
    } catch (error) {
      console.log('Index location_coordinates_idx already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('locations', ['city'], {
        name: 'location_city_idx'
      });
    } catch (error) {
      console.log('Index location_city_idx already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('locations', ['district'], {
        name: 'location_district_idx'
      });
    } catch (error) {
      console.log('Index location_district_idx already exists, skipping...');
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('locations', 'location_coordinates_idx');
    await queryInterface.removeIndex('locations', 'location_city_idx');
    await queryInterface.removeIndex('locations', 'location_district_idx');

    // Remove new columns
    await queryInterface.removeColumn('locations', 'formatted_address');
    await queryInterface.removeColumn('locations', 'country');
    await queryInterface.removeColumn('locations', 'country_code');

    // Revert latitude and longitude constraints
    await queryInterface.changeColumn('locations', 'latitude', {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true
    });

    await queryInterface.changeColumn('locations', 'longitude', {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true
    });

    // Revert address_text to nullable
    await queryInterface.changeColumn('locations', 'address_text', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
