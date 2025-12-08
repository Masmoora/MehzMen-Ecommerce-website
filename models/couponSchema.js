const mongoose = require('mongoose');
const {Schema} = mongoose;
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // WELCOME100

  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },

  value: {
    type: Number, required: true
  },

  startingDate: { type: Date, required: true }, // Coupon valid until

  expiryDate: { type: Date, required: true }, // Coupon valid until

  usedCount: { type: Number, default: 0 }, // How many times it has been used

  usedUsers: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      count: { type: Number, default: 0 } // How many times this user used it
    }
  ],

  status: { type: String, default: true } // Active / Inactive
});

module.exports = mongoose.model('Coupon', couponSchema);