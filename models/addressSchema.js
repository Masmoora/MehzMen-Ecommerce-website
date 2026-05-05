import mongoose from'mongoose';
const {Schema} = mongoose;

const addressSchema = new Schema({
  userId:{
    type:Schema.Types.ObjectId,
    ref:'User',
    required:true
  },
  address:[{
    name:{
      type:String,
      required:true
    },
    houseNo:{
      type:String,
      required:true
    },
    city:{
      type:String,
      required:true
    },
    landMark:{
      type:String,
      required:true
    },
    state:{
      type:String,
      required:true
    },
    country: { type: String, required: true, trim: true },
    pincode:{
      type:Number,
      required:true
    },
    phone:{
      type:String,
      required:true
    },

    isDefault:{
      type:Boolean,
      default:false
    }

  }]
});

const Address = mongoose.model('Address',addressSchema);
export default Address;