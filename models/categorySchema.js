import mongoose from 'mongoose';
import { type } from 'os';
const {Schema} = mongoose;

const categorySchema = new Schema({
  name:{
    type:String,
    required:true,
    unique:true
  },
  image:{
    type:String,
    default:''
  },
  description:{
    type:String,
    required:true
  },
  isListed:{
    type:Boolean,
    default:true
  },
  createdAt:{
    type:Date,
    default:Date.now
  }
});

const Category = mongoose.model('Category',categorySchema);
export default Category;