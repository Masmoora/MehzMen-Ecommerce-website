import Coupon from '../../models/couponSchema.js';
class CouponService {
  getCoupons = async ({ search = '', page = 1, limit = 10 }) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const filter = {};
    const trimmed = String(search || '').trim();
    if (trimmed) {
      const regex = new RegExp(trimmed, 'i');
      filter.$or = [{ code: regex }];
    }

    const [items, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      Coupon.countDocuments(filter)
    ]);
    //chech if coupon is expired
    const today = new Date()
    items.forEach(coupon => {
      if (coupon.endDate && new Date(coupon.endDate) < today) {
        coupon.status = "Expired"
      }
    })

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      coupons: items,
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
    return Coupon.findById(id).lean();
  };

  findByCodeExcludingId = async (code, excludeId) => {
    const filter = { code: String(code || '').trim().toUpperCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return Coupon.findOne(filter).lean();
  };

  create = async (data) => {
    const doc = new Coupon(data);
    await doc.save();
    return doc;
  };

  update = async (id, data) => {
    return Coupon.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  };

  delete = async (id) => {
    return Coupon.findByIdAndDelete(id).lean();
  };

}
export default new CouponService();