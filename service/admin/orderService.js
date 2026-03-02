import Order from '../../models/orderSchema.js';
import User from '../../models/userSchema.js';
import ProductVariant from '../../models/productVariantSchema.js';

class AdminOrderService {
  normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

  orderFlow = ['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered'];

  recalculatePricing = (orderDoc) => {
    const activeItems = (orderDoc.items || []).filter((item) => {
      const status = this.normalize(item.itemStatus);
      return !['cancelled', 'returned'].includes(status);
    });

    const subtotal = activeItems.reduce((sum, item) => sum + Number(item.itemTotal || 0), 0);
    const shippingCharge = activeItems.length ? Number(orderDoc.pricing?.shippingCharge || 0) : 0;
    const tax = Number(orderDoc.pricing?.tax || 0);
    const discount = Number(orderDoc.pricing?.couponDiscount || 0);
    const finalAmount = Math.max(0, subtotal + shippingCharge + tax - discount);

    orderDoc.pricing.totalItems = activeItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    orderDoc.pricing.subtotal = subtotal;
    orderDoc.pricing.shippingCharge = shippingCharge;
    orderDoc.pricing.finalAmount = finalAmount;
  };

  calculateOrderStatus = (orderDoc) => {
    const statuses = (orderDoc.items || []).map((item) => this.normalize(item.itemStatus));
    const activeStatuses = statuses.filter((status) => !['cancelled', 'returned'].includes(status));

    if (statuses.length && statuses.every((status) => status === 'cancelled')) return 'cancelled';
    if (statuses.length && statuses.every((status) => status === 'returned')) return 'returned';
    if (activeStatuses.length && activeStatuses.every((status) => status === 'delivered')) return 'delivered';
    if (activeStatuses.some((status) => status === 'delivered')) return 'partially_delivered';
    if (statuses.some((status) => status === 'return_requested')) return 'return_requested';
    if (statuses.some((status) => status === 'returned')) return 'partially_returned';
    return orderDoc.orderStatus || 'pending';
  };

  buildFilter = async ({ search = '', status = '' }) => {
    const filter = {};
    const keyword = String(search || '').trim();
    const statusValue = String(status || '').trim();

    if (statusValue) {
      filter.orderStatus = { $regex: `^${statusValue}$`, $options: 'i' };
    }

    if (!keyword) return filter;

    const users = await User.find({ name: { $regex: keyword, $options: 'i' } })
      .select('_id')
      .lean();

    filter.$or = [
      { orderId: { $regex: keyword, $options: 'i' } },
      { userId: { $in: users.map((user) => user._id) } }
    ];

    return filter;
  };

  listOrders = async ({ page = 1, limit = 10, search = '', status = '', sort = 'date_desc' }) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const sortMap = {
      date_desc: { createdAt: -1 },
      date_asc: { createdAt: 1 },
      amount_desc: { 'pricing.finalAmount': -1, createdAt: -1 },
      amount_asc: { 'pricing.finalAmount': 1, createdAt: -1 }
    };

    const filter = await this.buildFilter({ search, status });

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .populate('userId', 'name email')
        .sort(sortMap[sort] || sortMap.date_desc)
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Order.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalOrders / safeLimit));

    return {
      orders,
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalOrders,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages
      },
      filters: {
        search: String(search || '').trim(),
        status: String(status || '').trim(),
        sort: String(sort || 'date_desc')
      }
    };
  };

  getOrderDetails = async (orderId) => {
    const order = await Order.findOne({ orderId })
      .populate('userId', 'name email phone')
      .populate('items.variantId', 'stock')
      .lean();
    if (!order) throw new Error('Order not found');
    return order;
  };

  updateOrderStatus = async (orderId, nextStatus) => {
    const order = await Order.findOne({ orderId });
    if (!order) throw new Error('Order not found');

    const currentStatus = this.normalize(order.orderStatus);
    const targetStatus = this.normalize(nextStatus);

    if (!this.orderFlow.includes(targetStatus)) throw new Error('Invalid status');
    if (currentStatus === 'cancelled') throw new Error('Cannot update cancelled order');
    if (this.orderFlow.indexOf(targetStatus) <= this.orderFlow.indexOf(currentStatus)) {
      throw new Error('Cannot move status backward');
    }

    order.items.forEach((item) => {
      const itemStatus = this.normalize(item.itemStatus);
      if (!['cancelled', 'returned', 'return_requested', 'return_approved'].includes(itemStatus)) {
        item.itemStatus = targetStatus;
      }
    });

    order.orderStatus = this.calculateOrderStatus(order);
    await order.save();
    return order;
  };

  cancelOrder = async (orderId, cancelReason = '') => {
    const order = await Order.findOne({ orderId });
    if (!order) throw new Error('Order not found');

    const currentStatus = this.normalize(order.orderStatus);
    if (['cancelled', 'delivered', 'returned'].includes(currentStatus)) {
      throw new Error('Cannot cancel this order');
    }

    for (const item of order.items) {
      const itemStatus = this.normalize(item.itemStatus);
      if (!['cancelled', 'returned'].includes(itemStatus)) {
        item.itemStatus = 'cancelled';
        item.cancelReason = String(cancelReason || '').trim() || 'Cancelled by admin';
        item.returnStatus = 'none';

        await ProductVariant.updateOne(
          { _id: item.variantId },
          { $inc: { stock: Number(item.quantity || 0) } }
        );
      }
    }

    order.orderStatus = this.calculateOrderStatus(order);
    this.recalculatePricing(order);
    await order.save();
    return order;
  };

  updateItemStatus = async (orderId, itemId, nextStatus) => {
    const order = await Order.findOne({ orderId });
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Order item not found');

    const currentStatus = this.normalize(item.itemStatus);
    const targetStatus = this.normalize(nextStatus);

    if (!this.orderFlow.includes(targetStatus)) throw new Error('Invalid status');
    if (currentStatus === 'cancelled') throw new Error('Cannot update cancelled item');
    if (this.orderFlow.indexOf(targetStatus) <= this.orderFlow.indexOf(currentStatus)) {
      throw new Error('Cannot move status backward');
    }

    item.itemStatus = targetStatus;
    order.orderStatus = this.calculateOrderStatus(order);
    await order.save();
    return order;
  };

  cancelItem = async (orderId, itemId, cancelReason = '') => {
    const order = await Order.findOne({ orderId });
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Order item not found');
    if (this.normalize(item.itemStatus) === 'cancelled') throw new Error('Item already cancelled');

    item.itemStatus = 'cancelled';
    item.cancelReason = String(cancelReason || '').trim() || 'Cancelled by admin';
    item.returnStatus = 'none';

    await ProductVariant.updateOne(
      { _id: item.variantId },
      { $inc: { stock: Number(item.quantity || 0) } }
    );

    order.orderStatus = this.calculateOrderStatus(order);
    this.recalculatePricing(order);
    await order.save();
    return order;
  };

  approveReturn = async (orderId, itemId) => {
    const order = await Order.findOne({ orderId });
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Order item not found');

    const returnStatus = this.normalize(item.returnStatus);
    const itemStatus = this.normalize(item.itemStatus);
    if (returnStatus !== 'requested' && itemStatus !== 'return_requested') {
      throw new Error('Return request not found for this item');
    }

    item.returnStatus = 'approved';
    item.itemStatus = 'return_approved';

    order.orderStatus = this.calculateOrderStatus(order);
    await order.save();
    return order;
  };

  rejectReturn = async (orderId, itemId, rejectionReason = '') => {
    const order = await Order.findOne({ orderId });
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Order item not found');

    const returnStatus = this.normalize(item.returnStatus);
    const itemStatus = this.normalize(item.itemStatus);
    if (returnStatus !== 'requested' && itemStatus !== 'return_requested') {
      throw new Error('Return request not found for this item');
    }

    item.returnStatus = 'rejected';
    item.returnRejectionReason = String(rejectionReason || '').trim();
    item.itemStatus = 'delivered';

    order.orderStatus = this.calculateOrderStatus(order);
    await order.save();
    return order;
  };

  markReturned = async (orderId, itemId) => {
    const order = await Order.findOne({ orderId });
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Order item not found');

    if (this.normalize(item.returnStatus) !== 'approved' && this.normalize(item.itemStatus) !== 'return_approved') {
      throw new Error('Item must be approved before marking returned');
    }

    item.returnStatus = 'returned';
    item.itemStatus = 'returned';

    await ProductVariant.updateOne(
      { _id: item.variantId },
      { $inc: { stock: Number(item.quantity || 0) } }
    );

    order.orderStatus = this.calculateOrderStatus(order);
    this.recalculatePricing(order);
    await order.save();
    return order;
  };
}

export default new AdminOrderService();
