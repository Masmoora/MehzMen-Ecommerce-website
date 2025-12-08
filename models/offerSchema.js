const mongoose = require('mongoose');
const { Schema } = mongoose;

const offerSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },   // For Product Offer
  discountPercentage: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Offer', offerSchema);