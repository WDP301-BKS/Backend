'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add package-related fields to users table
    await queryInterface.addColumn('users', 'package_type', {
      type: Sequelize.ENUM('basic', 'premium', 'none'),
      allowNull: false,
      defaultValue: 'none'
    });

    await queryInterface.addColumn('users', 'package_purchase_date', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('users', 'business_license_image', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('users', 'identity_card_image', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Add indexes for performance
    await queryInterface.addIndex('users', ['package_type'], {
      name: 'idx_users_package_type'
    });

    await queryInterface.addIndex('users', ['package_purchase_date'], {
      name: 'idx_users_package_purchase_date'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('users', 'idx_users_package_type');
    await queryInterface.removeIndex('users', 'idx_users_package_purchase_date');

    // Remove columns
    await queryInterface.removeColumn('users', 'package_type');
    await queryInterface.removeColumn('users', 'package_purchase_date');
    await queryInterface.removeColumn('users', 'business_license_image');
    await queryInterface.removeColumn('users', 'identity_card_image');

    // Drop the ENUM type for package_type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_package_type";');
  }
};
