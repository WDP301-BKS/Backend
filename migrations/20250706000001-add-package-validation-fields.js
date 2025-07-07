const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Kiểm tra xem bảng fields có cột last_package_check chưa
    const tableDescription = await queryInterface.describeTable('fields');
    
    if (!tableDescription.last_package_check) {
      await queryInterface.addColumn('fields', 'last_package_check', {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Lần cuối kiểm tra trạng thái gói dịch vụ của chủ sân'
      });
    }

    // Thêm index để tối ưu truy vấn
    await queryInterface.addIndex('users', ['package_expire_date'], {
      name: 'idx_users_package_expire_date'
    });

    await queryInterface.addIndex('users', ['package_type'], {
      name: 'idx_users_package_type'
    });

    await queryInterface.addIndex('fields', ['is_verified', 'owner_id'], {
      name: 'idx_fields_verified_owner'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Xóa các index
    await queryInterface.removeIndex('users', 'idx_users_package_expire_date');
    await queryInterface.removeIndex('users', 'idx_users_package_type');
    await queryInterface.removeIndex('fields', 'idx_fields_verified_owner');

    // Xóa cột
    await queryInterface.removeColumn('fields', 'last_package_check');
  }
};
