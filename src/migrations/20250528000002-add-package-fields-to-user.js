'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'package_type', {
      type: Sequelize.ENUM('basic', 'premium', 'none'),
      defaultValue: 'none',
      allowNull: false
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'package_type');
    await queryInterface.removeColumn('users', 'package_purchase_date');
    await queryInterface.removeColumn('users', 'business_license_image');
    await queryInterface.removeColumn('users', 'identity_card_image');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_package_type";');
  }
}; 