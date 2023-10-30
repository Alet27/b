const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    index: true,
    validate: {
      validator: v => /\S+@\S+\.\S+/.test(v),
      message: props => `${props.value} is not a valid email!`
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  nickname: {
    type: String,
    trim: true,
    unique: true,
    index: true
  },
  bio: {
    type: String,
    trim: true
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  steamAccount: {
    type: String,
    trim: true
  },
  balance: {
    type: Number,
    default: 0
},
imageUrl: String 

  
});

module.exports = mongoose.model('User', userSchema);
