'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('field_pricing_rules', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },      field_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'fields',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      from_hour: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
          max: 23
        }
      },
      to_hour: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
          max: 23
        }
      },
      multiplier: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Add index for field_id
    await queryInterface.addIndex('field_pricing_rules', ['field_id'], {
      name: 'field_pricing_rules_field_id_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('field_pricing_rules');
  }
};
