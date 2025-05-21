const User = require('./user.model');
const Field = require('./field.model');
const SubField = require('./subfield.model');
const Location = require('./location.model');
const Booking = require('./booking.model');
const TimeSlot = require('./timeslot.model');
const Promotion = require('./promotion.model');
const Review = require('./review.model');
const Favorite = require('./favorite.model');
const Notification = require('./notification.model');
const BlacklistUser = require('./blacklist_user.model');
const Chat = require('./chat.model');
const Message = require('./message.model');
const { sequelize, testDbConnection } = require('../config/db.config');

// Define relationships
// User relationships
User.hasMany(Field, { foreignKey: 'owner_id' });
Field.belongsTo(User, { foreignKey: 'owner_id' });

User.hasMany(Booking, { foreignKey: 'user_id' });
Booking.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Review, { foreignKey: 'user_id' });
Review.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Favorite, { foreignKey: 'user_id' });
Favorite.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Notification, { foreignKey: 'user_id' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

// BlacklistUser relationship with User
User.hasMany(BlacklistUser, { foreignKey: 'blacklist_id' });
BlacklistUser.belongsTo(User, { foreignKey: 'blacklist_id', as: 'blacklistedUser' });

// Chat relationship with User
User.hasMany(Chat, { foreignKey: 'user_id1', as: 'chatsAsUser1' });
User.hasMany(Chat, { foreignKey: 'user_id2', as: 'chatsAsUser2' });
Chat.belongsTo(User, { foreignKey: 'user_id1', as: 'user1' });
Chat.belongsTo(User, { foreignKey: 'user_id2', as: 'user2' });

// Message relationship with User
User.hasMany(Message, { foreignKey: 'sender_id' });
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

// Field relationships
Field.hasMany(SubField, { foreignKey: 'field_id' });
SubField.belongsTo(Field, { foreignKey: 'field_id' });

Field.hasMany(Review, { foreignKey: 'field_id' });
Review.belongsTo(Field, { foreignKey: 'field_id' });

Field.hasMany(Favorite, { foreignKey: 'field_id' });
Favorite.belongsTo(Field, { foreignKey: 'field_id' });

Field.hasMany(Promotion, { foreignKey: 'field_id' });
Promotion.belongsTo(Field, { foreignKey: 'field_id' });

Field.belongsTo(Location, { foreignKey: 'location_id' });
Location.hasMany(Field, { foreignKey: 'location_id' });

// SubField relationships
SubField.hasMany(TimeSlot, { foreignKey: 'sub_field_id' });
TimeSlot.belongsTo(SubField, { foreignKey: 'sub_field_id' });

// Booking relationships
Booking.hasMany(TimeSlot, { foreignKey: 'booking_id' });
TimeSlot.belongsTo(Booking, { foreignKey: 'booking_id' });

// Chat and Message relationships
Chat.hasMany(Message, { foreignKey: 'chat_id' });
Message.belongsTo(Chat, { foreignKey: 'chat_id' });

// Function to sync all models with the database
const syncModels = async () => {
  try {
    await sequelize.sync();
    console.log('All models were synchronized successfully.');
  } catch (error) {
    console.error('Failed to sync models:', error);
  }
};

module.exports = {
  User,
  Field,
  SubField,
  Location,
  Booking,
  TimeSlot,
  Promotion,
  Review,
  Favorite,
  Notification,
  BlacklistUser,
  Chat,
  Message,
  sequelize,
  testDbConnection,
  syncModels
}; 