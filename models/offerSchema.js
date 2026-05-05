import mongoose from 'mongoose';
const { Schema } = mongoose;

const offerSchema = new Schema({
  offerType:{
    type:String,
    enum:["product","category"],
    required:true
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    default:null
 // one offer per product
  },
    categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    default:null
 // one offer per category
  },
  offerTitle: {
    type: String,
    required: true,
    trim:true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min:1
  },
  startDate: {
    type:Date,
    required:true
  },
  endDate: {
    type:Date,
    required:true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdAt: { type: Date, default: Date.now },
},{ timestamps: true });

export default mongoose.model('Offer', offerSchema);