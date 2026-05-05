import Order from '../../models/orderSchema.js';

/* ================================
   DATE HELPERS
================================ */

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDateRange(filter, start, end) {
  const now = new Date();

  if (filter === 'custom' && start && end) {
    return {
      from: startOfDay(start),
      to: endOfDay(end)
    };
  }

  if (filter === 'weekly') {
    const from = new Date(now);
    from.setDate(now.getDate() - 56); // last 8 weeks
    return { from: startOfDay(from), to: endOfDay(now) };
  }

  if (filter === 'yearly') {
    return {
      from: new Date(now.getFullYear() - 4, 0, 1),
      to: endOfDay(now)
    };
  }

  // monthly (default)
  return {
    from: new Date(now.getFullYear(), 0, 1),
    to: endOfDay(now)
  };
}

function getGroupId(filter) {
  if (filter === 'custom') {
    return {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' }
    };
  }

  if (filter === 'weekly') {
    return {
      year: { $isoWeekYear: '$createdAt' },
      week: { $isoWeek: '$createdAt' }
    };
  }

  if (filter === 'yearly') {
    return {
      year: { $year: '$createdAt' }
    };
  }

  return {
    year: { $year: '$createdAt' },
    month: { $month: '$createdAt' }
  };
}

/* ================================
   DASHBOARD SERVICE
================================ */

class DashboardService {
  async getDashboardData({ filter = 'monthly', start = '', end = '' } = {}) {

    const { from, to } = getDateRange(filter, start, end);

    const dateMatch = {
      createdAt: { $gte: from, $lte: to }
    };

    // Only exclude fully cancelled/returned orders
    const validOrdersMatch = {
      ...dateMatch,
      orderStatus: { $nin: ['cancelled', 'returned'] }
    };

    const [
      salesChart,
      orderStatus,
      totalRevenueAgg,
      totalOrders,
      totalCancels,
      totalReturns,
      bestProducts,
      bestCategories,
      bestBrands
    ] = await Promise.all([

      /* ================================
         SALES CHART
      ================================ */
      Order.aggregate([
        { $match: validOrdersMatch },
        {
          $group: {
            _id: getGroupId(filter),
            totalSales: { $sum: '$pricing.finalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } }
      ]),

      /* ================================
         ORDER STATUS (Pie Chart)
      ================================ */
      Order.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 }
          }
        }
      ]),

      /* ================================
         TOTAL REVENUE
      ================================ */
      Order.aggregate([
        { $match: validOrdersMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$pricing.finalAmount' }
          }
        }
      ]),

      /* ================================
         COUNTS
      ================================ */
      Order.countDocuments(dateMatch),
      Order.countDocuments({ ...dateMatch, orderStatus: 'cancelled' }),
      Order.countDocuments({ ...dateMatch, orderStatus: 'returned' }),

      /* ================================
         BEST PRODUCTS
      ================================ */
      Order.aggregate([
        { $match: validOrdersMatch },
        { $unwind: '$items' },
        {
          $match: {
            'items.itemStatus': { $nin: ['cancelled', 'returned'] }
          }
        },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.productName' },
            totalQty: { $sum: '$items.quantity' }
          }
        },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: 1, totalQty: 1 } }
      ]),

      /* ================================
         BEST CATEGORIES
      ================================ */
      Order.aggregate([
        { $match: validOrdersMatch },
        { $unwind: '$items' },
        {
          $match: {
            'items.itemStatus': { $nin: ['cancelled', 'returned'] }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $lookup: {
            from: 'categories',
            localField: 'product.category',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: '$category' },
        {
          $group: {
            _id: '$category._id',
            name: { $first: '$category.name' },
            totalQty: { $sum: '$items.quantity' }
          }
        },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: 1, totalQty: 1 } }
      ]),

      /* ================================
         BEST BRANDS
      ================================ */
      Order.aggregate([
        { $match: validOrdersMatch },
        { $unwind: '$items' },
        {
          $match: {
            'items.itemStatus': { $nin: ['cancelled', 'returned'] }
          }
        },
        {
          $group: {
            _id: '$items.brand',
            totalQty: { $sum: '$items.quantity' }
          }
        },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            name: { $ifNull: ['$_id', 'N/A'] },
            totalQty: 1
          }
        }
      ])
    ]);

    /* ================================
       FINAL RESPONSE
    ================================ */

    return {
      salesChart,
      orderStatus,
      totalRevenue: totalRevenueAgg[0]?.totalRevenue || 0,
      totalOrders,
      totalCancels,
      totalReturns,
      bestProducts,
      bestCategories,
      bestBrands
    };
  }
}

export default new DashboardService();