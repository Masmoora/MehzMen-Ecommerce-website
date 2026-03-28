
import User from '../../models/userSchema.js'
import Address from '../../models/addressSchema.js';
import bcrypt from 'bcrypt';
import Coupon from '../../models/couponSchema.js';

class ProfileService {
   updateUserProfileById = async (userId, updateData) => {
  return await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  );
}
  verifyPassword = async (plainPassword, hashedPassword) => {
    if (!plainPassword || !hashedPassword) return false;
    return bcrypt.compare(plainPassword, hashedPassword);
  };

  isEmailTaken = async (email, userId) => {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    const existing = await User.findOne({
      email: normalized,
      _id: { $ne: userId }
    }).lean();
    return !!existing;
  };

  updateEmail = async (userId, newEmail) => {
    return User.findByIdAndUpdate(
      userId,
      {
        $set: {
          email: newEmail,
          updatedAt: new Date()
        }
      },
      { new: true }
    );
  };

async addAddress(userId, addressData){

   let userAddress = await Address.findOne({ userId });
 
   // First address always default
   if(!userAddress){

      addressData.isDefault = true;

      userAddress = new Address({
         userId,
         address:[addressData]
      });

      return await userAddress.save();
   }

   // If new default → remove old default
   if(addressData.isDefault){
      await Address.updateOne(
         { userId },
         { $set:{ "address.$[].isDefault": false }}
      );
   }

   return await Address.findOneAndUpdate(
      { userId },
      { $push:{ address:addressData }},
      { new:true }
   );
}
  /*getUserAddresses = async (userId, page = 1, limit = 6) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Number(limit) || 6);
    const doc = await Address.findOne({ userId }).lean();

    if (!doc || !Array.isArray(doc.address) || doc.address.length === 0) {
      return { addresses: [], currentPage: safePage, totalPages: 1 };
    }

    const all = [...doc.address].reverse();
    const totalPages = Math.max(1, Math.ceil(all.length / safeLimit));
    const start = (safePage - 1) * safeLimit;
    const end = start + safeLimit;

    return {
      addresses: all.slice(start, end),
      currentPage: safePage,
      totalPages
    };
  };*/
  async getUserAddresses(userId, page = 1, limit = 2){

   const addressDoc = await Address.findOne({ userId }).lean();

   const allAddress = addressDoc?.address || [];

   const totalPages = Math.max(1, Math.ceil(allAddress.length / limit));

   // ⭐ prevent invalid page numbers
   const currentPage = Math.min(page, totalPages);

   const skip = (currentPage - 1) * limit;

   const addresses = allAddress.slice(skip, skip + limit);

   return {
      addresses,
      currentPage,
      totalPages
   };
}
  async editAddress(userId, addressId, updatedData) {

   try {
       // ⭐ If setting default
   if(updatedData.isDefault){
      await Address.updateOne(
         { userId },
         { $set:{ "address.$[].isDefault": false } }
      );
   }

      const updated = await Address.findOneAndUpdate(
         {
            userId: userId,
            "address._id": addressId
         },
         {
            $set: {
               "address.$.name": updatedData.name,
               "address.$.houseNo": updatedData.houseNo,
               "address.$.city": updatedData.city,
               "address.$.landMark": updatedData.landMark,
               "address.$.state": updatedData.state,
               "address.$.country": updatedData.country,
               "address.$.pincode": updatedData.pincode,
               "address.$.phone": updatedData.phone,
               "address.$.isDefault": updatedData.isDefault
            }
         },
         { new: true }
      );

      return updated;

   } catch (error) {

      console.log("Service edit error:", error);
      throw error;

   }
}
async deleteAddress(userId, addressId){

   try {

      const updated = await Address.findOneAndUpdate(
         { userId },
         {
            $pull:{
               address:{ _id: addressId }
            }
         },
         { new:true }
      );

      return updated;

   } catch(error){

      console.log("Delete service error:", error);
      throw error;

   }
}
  getCouponsForUserProfile = async () => {
    const now = new Date();
    const coupons = await Coupon.find({ isActive: true }).sort({ createdAt: -1 }).lean();

    return coupons.filter((coupon) => {
      if (coupon.startDate && new Date(coupon.startDate) > now) return false;
      if (coupon.endDate && new Date(coupon.endDate) < now) return false;
      if (coupon.usageLimit != null && (coupon.usedCount || 0) >= coupon.usageLimit) return false;
      return true;
    });
  };
}
export default new ProfileService();