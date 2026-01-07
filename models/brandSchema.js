import mongoose from 'mongoose';
const {Schema} = mongoose;

const brandSchema = new Schema({
  name : {
    type : String,
    required : true
  },
  logo : {
    type : String,
    required :true
  },
  isListed : {
    type : Boolean,
    default : true
  },
  createdAt : {
    type : Date,
    default : Date.now
  }

}, { timestamps: true });

const Brand = mongoose.model('Brand',brandSchema);
export default Brand;