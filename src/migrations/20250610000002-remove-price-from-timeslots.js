'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {  async up(queryInterface, Sequelize) {
    // Check if column exists before removing
    const tableDescription = await queryInterface.describeTable('timeslots');
    
    if (tableDescription.price) {
      await queryInterface.removeColumn('timeslots', 'price');
    }
  },

  async down(queryInterface, Sequelize) {
    // Thêm lại cột price nếu cần rollback
    await queryInterface.addColumn('timeslots', 'price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });
  }
};
