import mongoose from 'mongoose';
const {Schema} = mongoose;

//create the user schema(blueprint)
const userSchema = new Schema({
  name:{
    type:String,
    required:true
  },
  email:{
    type:String,
    required:true,
    unique:true
  },
  phone:{
    type:String,
    required:false,
    unique:false,
    sparse:true,
    default:null
  },
  googleId:{
    type:String,
    unique:true,
    sparse:true

  },
  password:{
    type:String,
    required:false
  },
  isBlocked:{
    type:Boolean,
    default:false
  },
  isAdmin:{
    type:Boolean,
    default:false
  },
  cart:[{
    type:Schema.Types.ObjectId,
    ref:'Cart'
  }],
  wallet:{
    type:Number,
    default:0
  },
  wishlist:[{
    type:Schema.Types.ObjectId,
    ref:'Wishlist'
  }],
  orderHistory:[{
    type:Schema.Types.ObjectId,
    ref:'Order'
  }],
  createdOn:{
    type:Date,
    default:Date.now
  },
  referralCode:{
    type:String,
    //  required:true
  },
  redeemed:{
    type:Boolean,
    //   required:true
  },
redeemedUsers: [{
  type: Schema.Types.ObjectId,
  ref: "User"
}],
  searchHistory:[{
    category:{
      type:Schema.Types.ObjectId,
      ref:'Category'
    },
    brand:{
      type:Schema.Types.ObjectId,
      ref:'Brand'
    },
    searchOn:{
      type:Date,
      default:Date.now
    }

  }]

});
//create the model(collection)
const User = mongoose.model('User',userSchema);
export default User;
