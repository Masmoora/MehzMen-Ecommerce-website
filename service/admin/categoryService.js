import { name } from 'ejs';
import Category from '../../models/categorySchema.js';
class CategoryService {
    async listCategory(search, page, limit) {
        let query = {};
        let skip = (page - 1) * limit;

        if (search) {
            query = { name: { $regex: ".*" + search + ".*", $options: "i" } };
        }
        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Category.countDocuments(query);
        return { categories, totalPages: Math.ceil(total / limit) };
    };
    // Add new category
    addCategory = async (categoryData) => {
        // Check duplicate category (case-insensitive)
        const normalizedName = categoryData.name.trim().replace(/\s+/g, " ");

        const existing = await Category.findOne({
            name: new RegExp(`^${normalizedName}$`, 'i')
        });

        if (existing) {
            return { success: false, reason: 'exists' };
        }

        const category = new Category({
            name: normalizedName,
            description: categoryData.description,
            image: categoryData.image,
            isListed: categoryData.isListed
        });

        await category.save();
        return { success: true };
    }

    updateCategory = async (id, updateData) => {
        return await Category.findByIdAndUpdate(id, updateData, { new: true });
    };

    // List category
    listCategoryStatus = async (id) => {
        return await Category.findByIdAndUpdate(
            id,
            { isListed: true },
            { new: true }
        );
    };

    // Unlist category
    unlistCategoryStatus = async (id) => {
        return await Category.findByIdAndUpdate(
            id,
            { isListed: false },
            { new: true }
        );
    };




}

export default new CategoryService();