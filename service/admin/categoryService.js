import { name } from 'ejs';
import Category from '../../models/categorySchema.js';
import Offer from '../../models/offerSchema.js'
class CategoryService {
    async listCategory(search, page, limit) {
        let query = {};
        let skip = (page - 1) * limit;

        if (search) {
            query = { name: { $regex: '.*' + search + '.*', $options: 'i' } };
        }
        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Category.countDocuments(query);
        // Get category ids
    const categoryIds = categories.map(c => c._id);

    // Find offers for those categories
    const offers = await Offer.find({
        offerType: "category",
        categoryId: { $in: categoryIds }
    }).lean();

    // Add hasOffer field
    categories.forEach(category => {
        category.hasOffer = offers.some(
            offer => offer.categoryId.toString() === category._id.toString()
        );
    });
        return { categories, totalPages: Math.ceil(total / limit) };
    };
    // Add new category
    addCategory = async (categoryData) => {
        // Check duplicate category (case-insensitive)
        const normalizedName = categoryData.name.trim().replace(/\s+/g, ' ');

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
    };
    // Get category by name (case-insensitive)
  getCategoryByNameInsensitive = async (name, excludeId = null) => {
    try {
      const filter = {
        name: { $regex: `^${name}$`, $options: 'i' }
      };
      if (excludeId) {
        filter._id = { $ne: excludeId };
      }
      const category = await Category.findOne(filter);
      return category;
    } catch (error) {
      throw error;
    }
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
    async getAllCategories() {
        return await Category.find({ isListed: true }).lean();
    }
    // ADD CATEGORY OFFER
  async addCategoryOffer(data) {

    const existingOffer = await Offer.findOne({
      offerType: "category",
      categoryId: data.categoryId
    });

    if (existingOffer) {
      throw new Error("Offer already exists for this category");
    }

    const offer = new Offer({
      offerType: "category",
      categoryId: data.categoryId,
      offerTitle: data.offerTitle,
      discountType: data.discountType,
      discountValue: data.discountValue,
      startDate: data.startDate,
      endDate: data.endDate
    });

    return await offer.save();
  }

  // GET CATEGORY OFFER
  async getCategoryOffer(categoryId) {

    return await Offer.findOne({
      offerType: "category",
      categoryId
    });

  }

  // EDIT CATEGORY OFFER
  async editCategoryOffer(categoryId, data) {

    return await Offer.findOneAndUpdate(
      {
        offerType: "category",
        categoryId
      },
      {
        offerTitle: data.offerTitle,
        discountType: data.discountType,
        discountValue: data.discountValue,
        startDate: data.startDate,
        endDate: data.endDate
      },
      { new: true }
    );

  }

  // REMOVE CATEGORY OFFER
  async removeCategoryOffer(categoryId) {

    return await Offer.findOneAndDelete({
      offerType: "category",
      categoryId
    });

  }

}

export default new CategoryService();