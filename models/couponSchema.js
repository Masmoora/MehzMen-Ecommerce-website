
import mongoose from 'mongoose';

const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0
    },
    maxDiscount: {
      type: Number,
      default: null,
      min: 0
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    usageLimit: { type: Number, default: null, min: 0 },// Total times this coupon can be used globally
    usedCount: { type: Number, default: 0, min: 0 } // How many times it has been used
  },
  { timestamps: true }
);

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;