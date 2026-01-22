import mongoose from 'mongoose';
const {Schema} = mongoose;

const productSchema = new Schema({
  name:{
    type:String,
    required:true
  },
  description:{
    type:String,
    required:true
  },
  brand: {
    type: Schema.Types.ObjectId,
    ref: 'Brand',
    required: true
  },
  category:{
    type:Schema.Types.ObjectId,
    ref:'Category',
    required:true,

  },
  isBlocked: {
      type: Boolean,
      default: true
    },
status: {
  type: String,
  enum: ['available', 'out_of_stock', 'discontinued'],
  required: true,
  default: 'available'
}

},{timestamps:true});

const Product = mongoose.model('Product',productSchema);

export default  Product;