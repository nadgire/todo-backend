const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  tasks: [],
  isAccountActive: Boolean,
});

const User = mongoose.model('User', UserSchema, 'User');

module.exports = User;
