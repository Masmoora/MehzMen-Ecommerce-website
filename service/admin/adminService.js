import User from '../../models/userSchema.js';
import bcrypt from 'bcrypt';
import moment  from 'moment';

import Order from '../../models/orderSchema.js';
const PAGE_SIZE = 10;

class AdminService {
    async findAdminByEmail(email) {
        return await User.findOne({email, isAdmin: true});
    }

    async comparePassword(plainPass,hashedPass) {
        return await bcrypt.compare(plainPass,hashedPass);
    }


//SalesReport

// Build date range based on rangeType and optional custom dates
getDateRange(rangeType, startDate, endDate) {
  const now = new Date();
  let from;
  let to;

  if (rangeType === 'custom' && startDate && endDate) {
    from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    to = new Date(endDate);
    to.setHours(23, 59, 59, 999);
    if (from > to) [from, to] = [to, from];
    return { from, to };
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (rangeType === 'day') {
    from = new Date(today);
    to = new Date(today);
    to.setHours(23, 59, 59, 999);
  } else if (rangeType === 'week') {
    // last 7 days including today
    from = new Date(today);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    to = new Date(today);
    to.setHours(23, 59, 59, 999);
  } else {
    // month (last 30 days)
    from = new Date(today);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    to = new Date(today);
    to.setHours(23, 59, 59, 999);
  }

  return { from, to };
}

// Main report service
async getSalesReport({
  rangeType = 'day',
  startDate,
  endDate,
  page = 1,
  limit = PAGE_SIZE
}) {
  const { from, to } = this.getDateRange(rangeType, startDate, endDate);

  const match = {
    orderStatus: { $nin: ['Returned', 'Cancelled', 'Processing'] },"pricing.finalAmount":{$gt:0}
  };
  if (from && to) {
    match.createdAt = { $gte: from, $lte: to };
  }

  // Get all matched orders for totals
  const allOrders = await Order.find(match)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const totalSale = allOrders.length;
  let totalAmount = 0;
  let totalDiscount = 0;
  let totalOffer = 0;

  const fullSalesData = allOrders.map((order) => {
    const orderTotal = order.pricing?.finalAmount ?? 0;
    const discount = order.pricing?.couponDiscount ?? 0;

    // You don't currently store per-product offer amount in Order.
    // For now we treat offer as 0. If you later add that field,
    // compute it here similarly to your friend's code.
    const offer = 0;

    totalAmount += orderTotal;
    totalDiscount += discount;
    totalOffer += offer;

    return {
      orderId: order.orderId,
      user: order.userId?.name || order.userId?.email || 'N/A',
      date: new Date(order.createdAt).toISOString().slice(0, 10),
      payment: order.paymentMethod || 'N/A',
      totalAmount: orderTotal,
      discount,
      offer
    };
  });

  const totalPages = Math.max(1, Math.ceil(totalSale / limit));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startIndex = (currentPage - 1) * limit;
  const salesDataPage = fullSalesData.slice(startIndex, startIndex + limit);

  return {
    salesDataPage,
    fullSalesData,
    totals: {
      totalSale,
      totalAmount,
      totalDiscount,
      totalOffer
    },
    pagination: {
      currentPage,
      totalPages
    }
  };
}

}
export default new AdminService();