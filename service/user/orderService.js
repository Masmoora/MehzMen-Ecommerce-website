import Order from "../../models/orderSchema.js";
import ProductVariant from "../../models/productVariantSchema.js";
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import walletService from "./walletService.js";

class OrderService {
  normalizeStatus = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
    isOrderPaid = (order) => {
    const method = this.normalizeStatus(order.paymentMethod || '');
    const status = this.normalizeStatus(order.paymentStatus || '');
    return (method === 'wallet' || method === 'razorpay') && status === 'completed';
  };

  /** Proportional refund for one item: (itemTotal / subtotal) * finalAmount */
  getProportionalRefund = (order, item) => {
    const subtotal = Number(order.pricing?.subtotal || 0);
    const finalAmount = Number(order.pricing?.finalAmount || 0);
    if (subtotal <= 0) return 0;
    return Math.round((Number(item.itemTotal || 0) / subtotal) * finalAmount);
  };

  refreshOrderStatusFromItems = (orderDoc) => {
    const statuses = orderDoc.items.map((item) => this.normalizeStatus(item.itemStatus));
    const activeStatuses = statuses.filter((status) => !['cancelled', 'returned'].includes(status));

    if (statuses.length && statuses.every((status) => status === 'cancelled')) {
      orderDoc.orderStatus = 'cancelled';
      return;
    }

    if (statuses.length && statuses.every((status) => status === 'returned')) {
      orderDoc.orderStatus = 'returned';
      return;
    }

    if (activeStatuses.length && activeStatuses.every((status) => status === 'delivered')) {
      orderDoc.orderStatus = 'delivered';
      return;
    }

    if (activeStatuses.some((status) => status === 'delivered')) {
      orderDoc.orderStatus = 'partially_delivered';
      return;
    }

    if (statuses.some((status) => status === 'return_requested')) {
      orderDoc.orderStatus = 'return_requested';
    }
  };

  getOrdersForUser = async (userId, queryData = {}) => {
    const page = Math.max(1, Number(queryData.page) || 1);
    const limit = Math.max(1, Math.min(20, Number(queryData.limit) || 8));
    const search = String(queryData.search || '').trim();

    const filter = { userId };
    if (search) {
      filter.orderStatus = { $regex: search, $options: 'i' };
    }

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalOrders / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      orders,
      pagination: {
        page: safePage,
        limit,
        totalOrders,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages
      },
      search
    };
  };

  getOrderForUser = async (userId, orderId) => {
    const order = await Order.findOne({ userId, orderId })
      .populate({
        path: 'items.productId',
        select: 'name brand'
      })
      .lean();

    if (!order) throw new Error('Order not found');
    return order;
  };

  recalculatePricing = (orderDoc) => {
    const activeItems = orderDoc.items.filter(
      (item) => this.normalizeStatus(item.itemStatus) !== 'cancelled'
    );
    const subtotal = activeItems.reduce((sum, item) => sum + item.itemTotal, 0);
    const shippingCharge = activeItems.length > 0 ? Number(orderDoc.pricing.shippingCharge || 0) : 0;
    const discount = Number(orderDoc.pricing.couponDiscount || 0);
   // const tax = Number(orderDoc.pricing.tax || 0);
    const finalAmount = Math.max(0, subtotal + shippingCharge  - discount);

    orderDoc.pricing.totalItems = activeItems.reduce((sum, item) => sum + item.quantity, 0);
    orderDoc.pricing.subtotal = subtotal;
    orderDoc.pricing.shippingCharge = shippingCharge;
    orderDoc.pricing.finalAmount = finalAmount;

    const allCancelled = orderDoc.items.every(
      (item) => this.normalizeStatus(item.itemStatus) === 'cancelled'
    );
    if (allCancelled) {
      orderDoc.orderStatus = 'cancelled';
      return;
    }

    const hasCancelled = orderDoc.items.some(
      (item) => this.normalizeStatus(item.itemStatus) === 'cancelled'
    );
    orderDoc.orderStatus = hasCancelled ? 'partially_cancelled' : orderDoc.orderStatus;

  };

  cancelSingleItem = async (userId, orderId, itemId, cancelReason = '') => {
    const order = await Order.findOne({ userId, orderId });
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Order item not found');

    if (!['processing', 'pending', 'confirmed'].includes(this.normalizeStatus(item.itemStatus))) {
      throw new Error('Only processing items can be cancelled');
    }
     // Refund to wallet for paid orders (cancel = direct refund)
    if (this.isOrderPaid(order)) {
      const refundAmount = this.getProportionalRefund(order, item);
      if (refundAmount > 0) {
        await walletService.refundToWallet(userId, refundAmount, order.orderId, 'Order item cancelled');
      }
    }

    item.itemStatus = 'cancelled';
    item.cancelReason = String(cancelReason || '').trim() || 'Cancelled by user';
    item.returnReason = '';
    item.returnDescription = '';

    // Return stock back to inventory after cancellation
    await ProductVariant.updateOne(
      { _id: item.variantId },
      { $inc: { stock: item.quantity } }
    );

    this.recalculatePricing(order);
    await order.save();

    return { orderId: order.orderId, orderStatus: order.orderStatus };
  };

  cancelEntireOrder = async (userId, orderId, cancelReason = '') => {
    const order = await Order.findOne({ userId, orderId });
    if (!order) throw new Error('Order not found');

    const cancellableStatuses = ['pending', 'placed', 'processing', 'confirmed'];
    if (!cancellableStatuses.includes(this.normalizeStatus(order.orderStatus))) {
      throw new Error('This order cannot be cancelled now');
    }

    const cancelledNow = [];
    order.items.forEach((item) => {
      if (['processing', 'pending', 'confirmed'].includes(this.normalizeStatus(item.itemStatus))) {
        item.itemStatus = 'cancelled';
        item.cancelReason = String(cancelReason || '').trim() || 'Cancelled by user';
        item.returnReason = '';
        item.returnDescription = '';
        cancelledNow.push({ variantId: item.variantId, quantity: item.quantity });
      }
    });

    if (!cancelledNow.length) {
      throw new Error('No processing items available to cancel');
    }
    // Refund full order amount to wallet for paid orders (cancel = direct refund)
    if (this.isOrderPaid(order)) {
      const refundAmount = Number(order.pricing?.finalAmount || 0);
      if (refundAmount > 0) {
        await walletService.refundToWallet(userId, refundAmount, order.orderId, 'Order cancelled');
      }
    }

    // Increase stock for every item that got cancelled now
    for (const item of cancelledNow) {
      await ProductVariant.updateOne(
        { _id: item.variantId },
        { $inc: { stock: item.quantity } }
      );
    }

    this.recalculatePricing(order);
    //order.orderStatus = 'cancelled';
    await order.save();

    return { orderId: order.orderId, orderStatus: order.orderStatus };
  };

  requestReturnOrder = async (userId, orderId, returnReason = '', returnDescription = '') => {
    const order = await Order.findOne({ userId, orderId });
    if (!order) throw new Error('Order not found');

    const reason = String(returnReason || '').trim();
    if (!reason) throw new Error('Return reason is required');

    const hasDeliveredItems = order.items.some(
      (item) => this.normalizeStatus(item.itemStatus) === 'delivered'
    );
    if (!hasDeliveredItems) {
      throw new Error('Return is allowed only for delivered items');
    }

    order.items.forEach((item) => {
      // Only delivered items are considered for return
      if (this.normalizeStatus(item.itemStatus) === 'delivered') {
        item.itemStatus = 'return_requested';
        item.returnStatus = 'requested';
        item.returnReason = reason;
        item.returnDescription = String(returnDescription || '').trim();
      }
    });

    this.refreshOrderStatusFromItems(order);
    order.returnReason = reason;
    await order.save();

    return { orderId: order.orderId, orderStatus: order.orderStatus };
  };

  requestItemReturn = async (
    userId,
    orderId,
    itemId,
    returnReason = '',
    returnDescription = '',
    returnImages = []
  ) => {
    const order = await Order.findOne({ userId, orderId });
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Order item not found');
    if (this.normalizeStatus(item.itemStatus) !== 'delivered') {
      throw new Error('Return is allowed only for delivered items');
    }

    const reason = String(returnReason || '').trim();
    if (!reason) throw new Error('Return reason is required');

    item.itemStatus = 'return_requested';
    item.returnStatus = 'requested';
    item.returnReason = reason;
    item.returnDescription = String(returnDescription || '').trim();
    item.returnImages = (Array.isArray(returnImages) ? returnImages : []).slice(0, 3);
    item.returnRejectionReason = '';

    this.refreshOrderStatusFromItems(order);
    await order.save();
    return { orderId: order.orderId, orderStatus: order.orderStatus };
  };

  cancelItemReturnRequest = async (userId, orderId, itemId) => {
    const order = await Order.findOne({ userId, orderId });
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Order item not found');
    if (item.returnStatus !== 'requested') {
      throw new Error('No active return request found for this item');
    }

    item.returnStatus = 'cancelled_by_user';
    item.itemStatus = 'delivered';
    item.returnRejectionReason = '';

    this.refreshOrderStatusFromItems(order);
    await order.save();
    return { orderId: order.orderId, orderStatus: order.orderStatus };
  };

  async generateInvoiceForOrder(userId, orderId) {

  const order = await Order.findOne({ orderId, userId });

  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  if (order.orderStatus !== 'delivered') {
    const error = new Error('Invoice available only for delivered orders');
    error.statusCode = 400;
    throw error;
  }

  if (!order.invoiceDate) {
    order.invoiceDate = new Date();
    await order.save();
  }

  const invoiceDir = path.join(process.cwd(), 'public', 'invoices');

  if (!fs.existsSync(invoiceDir)) {
    fs.mkdirSync(invoiceDir, { recursive: true });
  }

  const fileName = `invoice-${order.orderId}.pdf`;
  const filePath = path.join(invoiceDir, fileName);

  const invoiceTemplatePath = path.join(
    process.cwd(),
    'views',
    'user',
    'invoice.ejs'
  );

  const html = await ejs.renderFile(invoiceTemplatePath, { order });

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

export default new OrderService();
