import Order from '../../models/orderSchema.js';
import User from '../../models/userSchema.js';
import ProductVariant from '../../models/productVariantSchema.js';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import walletService from '../user/walletService.js';

class AdminOrderService {
  normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  orderFlow = ['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered'];
  isOrderPaid = (order) => {
    const method = this.normalize(order.paymentMethod || '');
    const status = this.normalize(order.paymentStatus || '');
    return (method === 'wallet' || method === 'razorpay') && status === 'completed';
  };

  getProportionalRefund = (order, item) => {
    const subtotal = Number(order.pricing?.subtotal || 0);
    const finalAmount = Number(order.pricing?.finalAmount || 0);
    if (subtotal <= 0) return 0;
    return Math.round((Number(item.itemTotal || 0) / subtotal) * finalAmount);
  };


  recalculatePricing = (orderDoc) => {
    const activeItems = (orderDoc.items || []).filter((item) => {
      const status = this.normalize(item.itemStatus);
      return !['cancelled', 'returned'].includes(status);
    });

    const subtotal = activeItems.reduce((sum, item) => sum + Number(item.itemTotal || 0), 0);
    const shippingCharge = activeItems.length ? Number(orderDoc.pricing?.shippingCharge || 0) : 0;
    
    const discount = Number(orderDoc.pricing?.couponDiscount || 0);
    const finalAmount = Math.max(0, subtotal + shippingCharge  - discount);

    orderDoc.pricing.totalItems = activeItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    orderDoc.pricing.subtotal = subtotal;
    orderDoc.pricing.shippingCharge = shippingCharge;
    orderDoc.pricing.finalAmount = finalAmount;
  };

  calculateOrderStatus = (orderDoc) => {
    const statuses = (orderDoc.items || []).map((item) =>
      this.normalize(item.itemStatus)
    );

    const activeStatuses = statuses.filter(
      (status) => !['cancelled', 'returned'].includes(status)
    );

    // All cancelled
    if (statuses.length && statuses.every((status) => status === 'cancelled')) {
      return 'cancelled';
    }

    // All returned
    if (statuses.length && statuses.every((status) => status === 'returned')) {
      return 'returned';
    }

    // Any return requested or approved
    if (
      statuses.some((status) =>
        ['return_requested', 'return_approved'].includes(status)
      )
    ) {
      return 'return_requested';
    }

    // Some returned
    if (statuses.some((status) => status === 'returned')) {
      return 'partially_returned';
    }

    // All active delivered
    if (
      activeStatuses.length &&
      activeStatuses.every((status) => status === 'delivered')
    ) {
      return 'delivered';
    }

    // Some delivered
    if (activeStatuses.some((status) => status === 'delivered')) {
      return 'partially_delivered';
    }

    //return orderDoc.orderStatus || 'pending';
    return 'processing'
  };

  buildFilter = async ({ search = '', status = '' }) => {
    const filter = {};
    const keyword = String(search || '').trim();
    const statusValue = String(status || '').trim();
    if (statusValue) {
      filter.orderStatus = { $regex: `${statusValue}`, $options: 'i' };
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
  getHighestItemFlowIndex(order) {
    let highestIndex = -1;

    for (const item of order.items || []) {
      const normalized = this.normalize(item.itemStatus);
      const index = this.orderFlow.indexOf(normalized);

      if (index > highestIndex) {
        highestIndex = index;
      }
    }

    return highestIndex;
  }
  updateOrderStatus = async (orderId, nextStatus) => {
    const order = await Order.findOne({ orderId });
    if (!order) throw new Error('Order not found');

    const currentStatus = this.normalize(order.orderStatus);
    const targetStatus = this.normalize(nextStatus);
    const highestItemIndex = this.getHighestItemFlowIndex(order);
    const targetIndex = this.orderFlow.indexOf(targetStatus);

    //  Prevent downgrade below any delivered/shipped item
    if (targetIndex < highestItemIndex) {
      throw new Error(
        `Cannot downgrade order below existing item progress.`
      );
    }
    if (['returned', 'cancelled', 'return_requested', 'return_approved'].includes(currentStatus)) {
      throw new Error('Cannot update returned or cancelled order');
    }

    //if (!this.orderFlow.includes(targetStatus)) throw new Error('Invalid status');
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
    if (['cancelled', 'delivered', 'returned','return_requested', 'return_approved'].includes(currentStatus)) {
      throw new Error('Cannot cancel this order');
    }
    if (this.isOrderPaid(order)) {
      const refundAmount = Number(order.pricing?.finalAmount || 0);
      if (refundAmount > 0 && order.userId) {
        await walletService.refundToWallet(order.userId, refundAmount, order.orderId, 'Order cancelled by admin');
      }
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

    if (['returned', 'cancelled'].includes(currentStatus)) {
      throw new Error('Cannot update a returned or cancelled item');
    }

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
    if (['delivered', 'returned', 'return_requested', 'return_approved'].includes(itemStatus)) {
      throw new Error('Delivered/returned/return-requested items cannot be cancelled');
    }
    if (['requested', 'approved', 'rejected', 'returned'].includes(returnStatus)) {
      throw new Error('Cannot cancel item with return lifecycle');
    }

    if (this.isOrderPaid(order)) {
      const refundAmount = this.getProportionalRefund(order, item);
      if (refundAmount > 0 && order.userId) {
        await walletService.refundToWallet(order.userId, refundAmount, order.orderId, 'Order item cancelled by admin');
      }
    }

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
    // Refund on admin approval (not on request).
    if (this.isOrderPaid(order)) {
      const refundAmount = this.getProportionalRefund(order, item);
      if (refundAmount > 0 && order.userId) {
        await walletService.refundToWallet(order.userId, refundAmount, order.orderId, 'Return approved by admin');
      }
    }

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
    const reason = String(rejectionReason || '').trim();
    if (!reason) {
      throw new Error('Rejection reason is required');
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
  async generateInvoiceForAdmin(orderId) {

    // 1️⃣ Find order (NO userId check for admin)
    const order = await Order.findOne({ orderId });

    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      throw error;
    }

    // 2️⃣ Optional: Allow invoice only if delivered
    if (order.orderStatus !== 'delivered') {
      const error = new Error('Invoice available only for delivered orders');
      error.statusCode = 400;
      throw error;
    }

    // 3️⃣ Add invoice date if not exists
    if (!order.invoiceDate) {
      order.invoiceDate = new Date();
      await order.save();
    }

    // 4️⃣ Create invoices folder
    const invoiceDir = path.join(process.cwd(), 'public', 'invoices');

    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    const fileName = `invoice-${order.orderId}.pdf`;
    const filePath = path.join(invoiceDir, fileName);

    // 5️⃣ Use SAME invoice.ejs (no need separate file)
    const templatePath = path.join(
      process.cwd(),
      'views',
      'user',
      'invoice.ejs'
    );

    const html = await ejs.renderFile(templatePath, { order });

    // 6️⃣ Generate PDF
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true
    });

    await browser.close();

    return { fileName, filePath };
  }


}

export default new AdminOrderService();



