import Offer from '../../models/offerSchema.js';
import Product from '../../models/productSchema.js';
import Category from '../../models/categorySchema.js'; // not used now, but ready for category offers

class OfferService {
  //PRODUCT OFFER
  async getProducts() {
    // Only show active / unblocked products
    return Product.find({
      isBlocked: { $ne: true }
    })
      .select('name')
      .sort({ name: 1 })
      .lean();
  }

  async getProductOffers(search = '', page = 1, limit = 10) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const filter = { offerType: 'product' };
    const trimmed = String(search || '').trim();
    if (trimmed) {
      filter.offerTitle = { $regex: trimmed, $options: 'i' };
    }

    const [offers, total] = await Promise.all([
      Offer.find(filter)
        .populate('productId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Offer.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      offers,
      page: safePage,
      totalPages
    };
  }

  async createOffer(data) {
    const offer = new Offer(data);
    await offer.save();
    return offer.toObject();
  }

  async updateOffer(id, data) {
    return Offer.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    }).lean();
  }

  async deleteOffer(id) {
    return Offer.findByIdAndDelete(id).lean();
  }

  async toggleOffer(id) {
    const offer = await Offer.findById(id);
    if (!offer) {
      throw new Error('Offer not found');
    }

    offer.status = offer.status === 'active' ? 'inactive' : 'active';
    await offer.save();
    return offer.toObject();
  }

  async existingProductOffer(productId) {
    return Offer.findOne({
      offerType: 'product',
      productId,
      status: 'active'
    }).lean();
  }
  //CATEGORY OFFER

  async getCategories() {
    return Category.find({ isListed: true })
      .select('name')
      .sort({ name: 1 })
      .lean();
  }

  async getCategoryOffers({ search = '', page = 1, limit = 10 }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const filter = { offerType: 'category' };
    const trimmed = String(search || '').trim();
    if (trimmed) {
      filter.offerTitle = { $regex: trimmed, $options: 'i' };
    }

    const [offers, total] = await Promise.all([
      Offer.find(filter)
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Offer.countDocuments(filter)
    ]);

    return {
      offers,
      page: safePage,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    };
  }

  async existingCategoryOffer(categoryId) {
    return Offer.findOne({
      offerType: 'category',
      categoryId,
      status: 'active'
    }).lean();
  }

  async createOffer(data) {
    const offer = new Offer(data);
    await offer.save();
    return offer.toObject();
  }

  async updateOffer(id, data) {
    return Offer.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    }).lean();
  }

  async deleteOffer(id) {
    return Offer.findByIdAndDelete(id).lean();
  }

  async toggleOffer(id) {
    const offer = await Offer.findById(id);
    if (!offer) return null;
    offer.status = offer.status === 'active' ? 'inactive' : 'active';
    await offer.save();
    return offer.toObject();
  }
}

export default new OfferService();