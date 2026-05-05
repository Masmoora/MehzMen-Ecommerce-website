import mongoose from 'mongoose';
const { Schema } = mongoose;

const productVariantSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  color: {
    type: String,
    required: true
  },
  sku: {
    type: String,
    required: true,
    trim: true
  },
    price:{
    type:Number,
    required:true
  },
  images: {
    type: [String],
    validate: [arr => arr.length >= 1, 'Each variant needs at least 1 images']
  },
  size: {
    type: String,
    required: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
},
  { timestamps: true }
);

productVariantSchema.index({ productId: 1 });

const ProductVariant = mongoose.model('ProductVariant', productVariantSchema);
export default ProductVariant;