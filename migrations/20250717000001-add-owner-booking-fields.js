const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Bookings', 'is_owner_booking', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Indicates if this booking was created by the field owner on behalf of a customer'
    });

    await queryInterface.addColumn('Bookings', 'created_by_owner', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Owner ID who created this booking (if is_owner_booking is true)'
    });

    await queryInterface.addColumn('Bookings', 'deposit_amount', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Deposit amount paid (for partial payments)'
    });

    await queryInterface.addColumn('Bookings', 'remaining_amount', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Remaining amount to be paid'
    });

    await queryInterface.addColumn('Bookings', 'payment_method', {
      type: DataTypes.ENUM('cash', 'transfer', 'card', 'stripe'),
      allowNull: true,
      comment: 'Payment method used for this booking'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Bookings', 'is_owner_booking');
    await queryInterface.removeColumn('Bookings', 'created_by_owner');
    await queryInterface.removeColumn('Bookings', 'deposit_amount');
    await queryInterface.removeColumn('Bookings', 'remaining_amount');
    await queryInterface.removeColumn('Bookings', 'payment_method');
  }
};
