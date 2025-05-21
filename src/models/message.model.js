const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.config');

const Message = sequelize.define('message', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  sender_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  content: {
    type: DataTypes.STRING,
    allowNull: false
  },
  chat_id: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'update_at'
});

module.exports = Message; 