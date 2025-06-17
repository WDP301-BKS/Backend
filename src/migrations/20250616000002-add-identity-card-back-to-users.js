'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'identity_card_back_image', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'URL của ảnh mặt sau CCCD/CMND'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'identity_card_back_image');
  }
};
