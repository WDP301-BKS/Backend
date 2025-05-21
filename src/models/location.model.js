const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.config');

const Location = sequelize.define('location', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8)
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8)
  },
  geom: {
    type: DataTypes.JSON,
    comment: 'GeoJSON format for geometry data'
  },
  address_text: {
    type: DataTypes.STRING
  },
  city: {
    type: DataTypes.STRING
  },
  district: {
    type: DataTypes.STRING
  },
  ward: {
    type: DataTypes.STRING
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Location; 