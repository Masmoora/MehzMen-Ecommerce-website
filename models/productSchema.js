import mongoose from 'mongoose';
const {Schema} = mongoose;

const productSchema = new Schema({
  name:{
    type:String,
    required:true
  },
  //description:{
   // type:String,
   // required:true
  //},
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
  price:{
    type:Number,
    required:true
  },
  offerPrice:{
    type:Number,
    default:null
  },
  isBlocked: {
      type: Boolean,
      default: true
    },
  status:{
    type:String,
    enum:['Available','Out of stock','Discontinued'],
    required:true,
    default:'Available'
  }

},{timestamps:true});

const Product = mongoose.model('Product',productSchema);

export default  Product;