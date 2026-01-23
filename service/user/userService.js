import User from '../../models/userSchema.js';
import bcrypt from 'bcrypt';
import Product from '../../models/productSchema.js';
import ProductVariant from '../../models/productVariantSchema.js';
import Category from '../../models/categorySchema.js';
import Brand from '../../models/brandSchema.js';

class UserService {
    //check existing user
    async findByEmail(email) {
        return await User.findOne({ email });
    }

    //create new user
    async createUser(data) {
        return await User.create(data);
    }
    //find user by googleid or email
    async findOrCreateGoogleUser(profile) {
        const filter = {
            $or: [
                { googleId: profile.id },
                { email: profile.emails[0].value.toLowerCase() }
            ]
        };

        const update = {
            name: profile.displayName,
            email: profile.emails[0].value.toLowerCase(),
            googleId: profile.id,
        };

        const options = { new: true, upsert: true };

        const user = await User.findOneAndUpdate(filter, update, options);
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
            { password }
        );
    }

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