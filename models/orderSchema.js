import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const { Schema } = mongoose;

/* ================================
   ORDER ITEM SCHEMA (Snapshot Based)
================================ */

const orderItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },

  variantId: {
    type: Schema.Types.ObjectId,
    ref: 'ProductVariant',
    required: true
  },

  // Snapshot Fields (VERY IMPORTANT)
  productName: {
    type: String,
    required: true
  },

  brand: {
    type: String,
    default: 'N/A'
  },

  image: {
    type: String,
    default: ''
  },

  color: {
    type: String,
    default: '-'
  },

  size: {
    type: String,
    default: '-'
  },

  quantity: {
    type: Number,
    required: true,
    min: 1
  },

  price: {
    type: Number,
    required: true,
    min: 0
  },

  itemTotal: {
    type: Number,
    required: true,
    min: 0
  },

  itemStatus: {
    type: String,
    enum: [
      'Processing',
      'Cancelled',
      'Returned',
      'Return Requested'
    ],
    default: 'Processing'
  },

  cancelReason: {
    type: String,
    default: ''
  },

  returnReason: {
    type: String,
    default: ''
  }

}, { _id: true });

/* ================================
   SHIPPING ADDRESS (Snapshot)
================================ */

const shippingAddressSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  houseNo: { type: String, required: true },
  city: { type: String, required: true },
  landMark: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  pincode: { type: Number, required: true }
}, { _id: false });

/* ================================
   PRICING BREAKDOWN
================================ */

const pricingSchema = new Schema({
  totalItems: {
    type: Number,
    required: true,
    min: 0
  },

  subtotal: {
    type: Number,
    required: true,
    min: 0
  },

  shippingCharge: {
    type: Number,
    required: true,
    min: 0
  },

  tax: {
    type: Number,
    default: 0,
    min: 0
  },

  couponCode: {
    type: String,
    default: ''
  },

  couponDiscount: {
    type: Number,
    default: 0,
    min: 0
  },

  finalAmount: {
    type: Number,
    required: true,
    min: 0
  }

}, { _id: false });

/* ================================
   MAIN ORDER SCHEMA
================================ */

const orderSchema = new Schema({

  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    index: true
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  items: {
    type: [orderItemSchema],
    required: true
  },

  shippingAddress: {
    type: shippingAddressSchema,
    required: true
  },

  pricing: {
    type: pricingSchema,
    required: true
  },

  paymentMethod: {
    type: String,
    enum: ['cod', 'wallet', 'razorpay'],
    default: 'cod'
  },

  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    default: 'Pending'
  },

  orderStatus: {
    type: String,
    enum: [
      'Pending',
      'Placed',
      'Processing',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Return Requested',
      'Cancelled',
      'Partially Cancelled',
      'Returned',
      'Partially Returned'
    ],
    default: 'Placed'
  },

  invoiceDate: {
    type: Date
  },

  cancelReason: {
    type: String,
    default: ''
  },

  returnReason: {
    type: String,
    default: ''
  }

}, { timestamps: true });

/* ================================
   MODEL EXPORT
================================ */

const Order = mongoose.model('Order', orderSchema);

export default Order;
