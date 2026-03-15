import Offer from '../../models/offerSchema.js';
import Product from '../../models/productSchema.js';
import Category from '../../models/categorySchema.js';

class OfferService {
  getOffers = async ({ search = '', page = 1, limit = 10 }) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const filter = {};
    const trimmed = String(search || '').trim();
    if (trimmed) {
      filter.name = new RegExp(trimmed, 'i');
    }

    const [items, total] = await Promise.all([
      Offer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      Offer.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      offers: items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalItems: total,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages
      }
    };
  };

  getById = async (id) => {
    return Offer.findById(id).lean();
  };

  getProductsForDropdown = async () => {
    return Product.find({ isBlocked: { $ne: true } }).select('name').sort({ name: 1 }).lean();
  };

  getCategoriesForDropdown = async () => {
    return Category.find({ isListed: true }).select('name').sort({ name: 1 }).lean();
  };

  addOffer = async (data) => {
    const doc = new Offer(data);
    await doc.save();
    return doc.toObject();
  };

  updateOffer = async (id, data) => {
    return Offer.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  };

  deactivateOffer = async (id) => {
    return Offer.findByIdAndUpdate(id, { isActive: false }, { new: true, runValidators: true }).lean();
  };
}

export default new OfferService();
