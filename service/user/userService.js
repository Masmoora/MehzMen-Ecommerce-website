import User from '../../models/userSchema.js';
import bcrypt from 'bcrypt';
import Product from '../../models/productSchema.js';
import ProductVariant from '../../models/productVariantSchema.js';
import Category from '../../models/categorySchema.js';
import Brand from '../../models/brandSchema.js';
import Coupon from '../../models/couponSchema.js'

class UserService {
    //check existing user
    async findByEmail(email) {
        return await User.findOne({ email });
    }

    //create new user
    async createUser(data) {
        return await User.create(data);
    }
     async findOrCreateGoogleUser(profile) {
        const email = profile.emails[0].value.toLowerCase();

        // 1️⃣ Find user by googleId OR email
        let user = await User.findOne({
            $or: [
                { googleId: profile.id },
                { email }
            ]
        });

        // 2️⃣ If user exists and is BLOCKED → STOP LOGIN
        if (user && user.isBlocked) {
            return null;
        }

        // 3️⃣ If user exists and not blocked → attach googleId if missing
        if (user) {
            if (!user.googleId) {
                user.googleId = profile.id;
                await user.save();
            }
            return user;
        }

        // 4️⃣ Create NEW user
        user = new User({
            name: profile.displayName,
            email,
            googleId: profile.id,
            isBlocked: false
        });

        await user.save();
        return user;
    }


    async getUserById(id) {
        return await User.findById(id);
    }

    async findUserByEmail(email) {
        return await User.findOne({ email, isAdmin: 0 });
    }

    async validatePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // update password
    async updatePasswordByEmail(email, password) {
        return await User.findOneAndUpdate(
            { email },
            { $set: { password: password } }
        );
    }
      findByReferralCode = async (referralCode) => {
    const code = String(referralCode || '').trim().toUpperCase();
    if (!code) return null;
    return User.findOne({ referralCode: code });
  };

  generateReferralCode = (name = '') => {
    const clean = String(name || 'USR').replace(/[^a-zA-Z]/g, '');
    const prefix = (clean.substring(0, 3) || 'USR').toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${random}`;
  };

  generateUniqueReferralCode = async (name = '') => {
    for (let i = 0; i < 25; i += 1) {
      const code = this.generateReferralCode(name);
      const exists = await User.exists({ referralCode: code });
      if (!exists) return code;
    }
    return `USR${Date.now().toString().slice(-6)}`;
  };

  createReferralRewardCoupons = async (referrerId, newUserId) => {
    await Coupon.create({
      code: `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: 'fixed',
      value: 100,
      userId: referrerId,
            usageLimit: 1,
      usedCount: 0,
      isActive: true,
      isReferralReward: true,
      referralTitle: 'Referral Bonus ₹100 OFF'
    });

    await Coupon.create({
      code: `WELCOME-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'fixed',
      value: 50,
      userId: newUserId,
            usageLimit: 1,
      usedCount: 0,
      isActive: true,
      isReferralReward: true,
      referralTitle: 'Welcome Referral Bonus ₹50 OFF'
    });
  };

    // Get newest products with cheapest active variant
    getNewArrivals = async (limit = 12) => {
        const products = await Product.find({ isBlocked: false })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('brand', 'name')
            .lean();

        const cards = [];

        for (const product of products) {
            const variants = await ProductVariant.find({
                productId: product._id,
                isActive: true,
                stock: { $gt: 0 }
            }).lean();

            if (!variants.length) continue;

            variants.sort((a, b) => a.price - b.price);
            const cheapest = variants[0];

            cards.push({
                _id: product._id,
                name: product.name,
                brandName: product.brand?.name || 'N/A',
                image: cheapest.images?.[0] || '',
                price: cheapest.price || 0
            });
        }

        return cards;
    };

    // Get categories for "Shop by Category"
    getCategories = async (limit = 6) => {
        return Category.find({ isListed: true })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    };

    // Get brands for "Top Brands"
    getBrands = async (limit = 8) => {
        return Brand.find({ isListed: true })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    };

}

export default new UserService();