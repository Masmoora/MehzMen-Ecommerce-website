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

referralCode: {
    type: String,
    trim: true,
    uppercase: true,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralRewardGiven: {
    type: Boolean,
    default: false
  },
  profileImage: {
  type: String,   // S3 image URL
  default: null
},
redeemedUsers: [{
  type: Schema.Types.ObjectId,
  ref: 'User'
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

},{ timestamps: true } // ✅ adds createdAt & updatedAt
);
//create the model(collection)
const User = mongoose.model('User',userSchema);
export default User;
