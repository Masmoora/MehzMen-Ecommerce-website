import Order from "../../models/orderSchema.js";
import ProductVariant from "../../models/productVariantSchema.js";
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OrderService{
   
  generateInvoiceForOrder = async (userId, orderId) => {
    let browser;

    try {
      const order = await Order.findOne({ orderId, userId });
      if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
      }

      if (order.orderStatus == 'Delivered') {
        const err = new Error('Invoice is only available for delivered orders.');
        err.statusCode = 400;
        throw err;
      }

      if (!order.invoiceDate) {
        order.invoiceDate = new Date();
        await order.save();
      }

      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      const invoiceTemplatePath = path.join(__dirname, '../../views/user/invoice.ejs');
      const html = await ejs.renderFile(invoiceTemplatePath, { order });

      await page.setContent(html, { waitUntil: 'networkidle0' });

      const invoiceDir = path.join(__dirname, '../../public/invoices');
      if (!fs.existsSync(invoiceDir)) {
        fs.mkdirSync(invoiceDir, { recursive: true });
      }

      const fileName = `invoice-${order.orderId}.pdf`;
      const filePath = path.join(invoiceDir, fileName);

      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });

      return { fileName, filePath };
    } finally {
      if (browser) await browser.close();
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
    const activeItems = orderDoc.items.filter((item) => item.itemStatus !== 'Cancelled');
    const subtotal = activeItems.reduce((sum, item) => sum + item.itemTotal, 0);
    const shippingCharge = activeItems.length > 0 ? Number(orderDoc.pricing.shippingCharge || 0) : 0;
    const discount = Number(orderDoc.pricing.couponDiscount || 0);
    const tax = Number(orderDoc.pricing.tax || 0);
    const finalAmount = Math.max(0, subtotal + shippingCharge + tax - discount);

    orderDoc.pricing.totalItems = activeItems.reduce((sum, item) => sum + item.quantity, 0);
    orderDoc.pricing.subtotal = subtotal;
    orderDoc.pricing.shippingCharge = shippingCharge;
    orderDoc.pricing.finalAmount = finalAmount;

    const allCancelled = orderDoc.items.every((item) => item.itemStatus === 'Cancelled');
    if (allCancelled) {
      orderDoc.orderStatus = 'Cancelled';
      return;
    }

    const hasCancelled = orderDoc.items.some((item) => item.itemStatus === 'Cancelled');
    orderDoc.orderStatus = hasCancelled ? 'Partially Cancelled' : orderDoc.orderStatus;
  };

  cancelSingleItem = async (userId, orderId, itemId, cancelReason = '') => {
    const order = await Order.findOne({ userId, orderId });
    if (!order) throw new Error('Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new Error('Order item not found');

    if (item.itemStatus !== 'Processing') {
      throw new Error('Only processing items can be cancelled');
    }

    item.itemStatus = 'Cancelled';
    item.cancelReason = String(cancelReason || '').trim() || 'Cancelled by user';
    item.returnReason = '';

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

    const cancellableStatuses = ['Pending', 'Placed', 'Processing'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      throw new Error('This order cannot be cancelled now');
    }

    const cancelledNow = [];
    order.items.forEach((item) => {
      if (item.itemStatus === 'Processing') {
        item.itemStatus = 'Cancelled';
        item.cancelReason = String(cancelReason || '').trim() || 'Cancelled by user';
        item.returnReason = '';
        cancelledNow.push({ variantId: item.variantId, quantity: item.quantity });
      }
    });

    if (!cancelledNow.length) {
      throw new Error('No processing items available to cancel');
    }

    // Increase stock for every item that got cancelled now
    for (const item of cancelledNow) {
      await ProductVariant.updateOne(
        { _id: item.variantId },
        { $inc: { stock: item.quantity } }
      );
    }

    this.recalculatePricing(order);
    order.orderStatus = 'Cancelled';
    await order.save();

    return { orderId: order.orderId, orderStatus: order.orderStatus };
  };

  requestReturnOrder = async (userId, orderId, returnReason = '') => {
    const order = await Order.findOne({ userId, orderId });
    if (!order) throw new Error('Order not found');

    if (order.orderStatus !== 'Delivered') {
      throw new Error('Return is allowed only after order is delivered');
    }

    const reason = String(returnReason || '').trim();
    if (!reason) throw new Error('Return reason is required');

    order.items.forEach((item) => {
      // Only non-cancelled items are considered for return
      if (item.itemStatus !== 'Cancelled') {
        item.itemStatus = 'Return Requested';
        item.returnReason = reason;
      }
    });

    order.orderStatus = 'Return Requested';
    order.returnReason = reason;
    await order.save();

    return { orderId: order.orderId, orderStatus: order.orderStatus };
  };

}
export default new OrderService()