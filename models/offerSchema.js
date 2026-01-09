import mongoose from 'mongoose';
const { Schema } = mongoose;

const offerSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    unique: true   // one offer per product
  },
  offerTitle: {
    type: String,
    required: true
  },
  discountType: {
    type: String,
    enum: ["PERCENTAGE", "FIXED"],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  startDate: Date,
  endDate: Date,
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active"
  },
  createdAt: { type: Date, default: Date.now },
},{ timestamps: true });

export default mongoose.model('Offer', offerSchema);