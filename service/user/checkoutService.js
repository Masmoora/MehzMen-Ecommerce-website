import Address from "../../models/addressSchema.js";
import User from "../../models/userSchema.js";
import Offer from "../../models/offerSchema.js";
import Cart from "../../models/cartSchema.js";
import Order from "../../models/orderSchema.js";
import ProductVariant from "../../models/productVariantSchema.js";
import * as razorpayService from '../payment/razorpayService.js'
import walletService from "./walletService.js";
import Coupon from "../../models/couponSchema.js";
import { getBestOffer } from "../../utils/offerHelper.js";
const SHIPPING_FLAT = 50;

class CheckoutService {
  reserveStockForOrder = async (items) => {
    const reservedItems = [];

    for (const item of items) {
      const result = await ProductVariant.updateOne(
        { _id: item.variantId, isActive: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );

      if (!result.modifiedCount) {
        for (const reserved of reservedItems) {
          await ProductVariant.updateOne(
            { _id: reserved.variantId },
            { $inc: { stock: reserved.quantity } }
          );
        }
        throw new Error(`Stock is not enough for ${item.productName}. Please refresh and try again.`);
      }

      reservedItems.push({ variantId: item.variantId, quantity: item.quantity });
    }

    return reservedItems;
  };

  restoreReservedStock = async (reservedItems = []) => {
    for (const reserved of reservedItems) {
      await ProductVariant.updateOne(
        { _id: reserved.variantId },
        { $inc: { stock: reserved.quantity } }
      );
    }
  };

  getCartItemsForCheckout = async (userId) => {
    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: { path: 'brand', select: 'name' }
      })
      .populate('items.variantId')
      .lean();

    if (!cart || !cart.items?.length) return [];

    //return cart.items.map((item) => {
    const processedItems = await Promise.all(cart.items.map(async (item) => {

      const product = item.productId;
      const variant = item.variantId;
      const stock = variant?.stock || 0;

      if (stock <= 0 || !variant?.isActive) {
        await Cart.updateOne(
          { userId },
          { $pull: { items: { _id: item._id } } }
        );
        return null;
      }

      let price = item.salePrice;
      let discount = item.discount;

      if (product && variant) {

        const now = new Date();

        const commonFilter = {
          status: 'active',
          startDate: { $lte: now },
          endDate: { $gte: now }
        };

        const [productOffer, categoryOffer] = await Promise.all([
          Offer.findOne({
            ...commonFilter,
            offerType: 'product',
            productId: product._id
          }).lean(),

          Offer.findOne({
            ...commonFilter,
            offerType: 'category',
            categoryId: product.category
          }).lean()
        ]);

        const best = getBestOffer(variant.price, productOffer, categoryOffer);

        price = best.finalPrice;
        discount = best.discountAmount;
      }

      const outOfStock =
        !product ||
        product.isBlocked ||
        product.status !== 'available' ||
        !variant ||
        !variant.isActive ||
        stock <= 0;

      return {
        _id: item._id.toString(),
        productId: product?._id?.toString() || '',
        variantId: variant?._id?.toString() || '',
        productName: product?.name || 'Product',
        brand: product?.brand?.name || 'N/A',
        image: variant?.images?.[0] || '',
        color: variant?.color || '-',
        size: variant?.size || '-',
        quantity: item.quantity,

        originalPrice: variant.price,
        price: price,
        discount: discount,

        discountPercent:
          variant.price > price
            ? Math.round(((variant.price - price) / variant.price) * 100)
            : 0,

        itemTotal: price * item.quantity,
        outOfStock
      };
    }));
    return processedItems.filter(Boolean);
  };

  getAddressData = async (userId) => {
    const doc = await Address.findOne({ userId }).lean();
    const addresses = doc?.address || [];
    const defaultAddress = addresses.find((addr) => addr.isDefault) || null;

    return {
      addresses,
      defaultAddressId: defaultAddress?._id?.toString() || (addresses[0]?._id?.toString() || '')
    };
  };


  getValidCoupon = async (code, subtotal = 0, userId = null) => {
    const raw = String(code || '').trim();
    if (!raw) return null;
    const coupon = await Coupon.findOne({
      code: raw.toUpperCase(),
      isActive: true,
      $or: [{ userId: null }, { userId }]
    }).lean();
    if (!coupon) return null;
    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) return null;
    if (coupon.endDate && new Date(coupon.endDate) < now) return null;
    // Referral reward coupons are strictly one-time use.
    if (coupon.isReferralReward && Number(coupon.usedCount || 0) >= 1) return null;
    if (coupon.usageLimit != null && (coupon.usedCount || 0) >= coupon.usageLimit) return null;
    if (Number(coupon.minOrderValue || 0) > subtotal) return null;
    return coupon;
  };

  /**
   * Compute discount amount from coupon and subtotal. Respects maxDiscount for percentage.
   */
  computeCouponDiscount = (coupon, subtotal) => {
    if (!coupon || subtotal <= 0) return 0;
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = Math.round((subtotal * Number(coupon.value || 0)) / 100);
      if (coupon.maxDiscount != null && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
    } else {
      discount = Math.min(Number(coupon.value || 0), subtotal);
    }
    return Math.max(0, discount);
  };

  buildSummary = (items, couponDoc = null) => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
    const shipping = items.length ? SHIPPING_FLAT : 0;
    const discount = couponDoc ? this.computeCouponDiscount(couponDoc, subtotal) : 0;
    const finalTotal = Math.max(0, subtotal + shipping - discount);

    return {
      totalItems,
      subtotal,
      shipping,
      discount,
      couponCode: couponDoc ? couponDoc.code : '',
      finalTotal
    };
  };

  getAvailableCouponsForCheckout = async (items, userId) => {
    if (!items?.length) return [];

    const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      $or: [{ userId: null }, { userId }]
    }).sort({ createdAt: -1 }).lean();

    return coupons
      .filter((coupon) => {
        if (coupon.startDate && new Date(coupon.startDate) > now) return false;
        if (coupon.endDate && new Date(coupon.endDate) < now) return false;
        // Referral reward coupons are strictly one-time use.
        if (coupon.isReferralReward && Number(coupon.usedCount || 0) >= 1) return null;
        if (coupon.usageLimit != null && (coupon.usedCount || 0) >= coupon.usageLimit) return false;
        return true;
      })
      .map((coupon) => {
        const isEligible = Number(coupon.minOrderValue || 0) <= subtotal;
        const possibleDiscount = isEligible ? this.computeCouponDiscount(coupon, subtotal) : 0;
        return {
          code: coupon.code,
          type: coupon.type,
          value: Number(coupon.value || 0),
          minOrderValue: Number(coupon.minOrderValue || 0),
          maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
          isReferralReward: !!coupon.isReferralReward,
          referralTitle: coupon.referralTitle || '',
          isEligible,
          possibleDiscount
        };
      });
  };


  getCheckoutPageData = async (userId) => {
    const items = await this.getCartItemsForCheckout(userId);
    const { addresses, defaultAddressId } = await this.getAddressData(userId);
    const summary = this.buildSummary(items);
    const walletBalance = await walletService.getBalance(userId);
    const user = await User.findById(userId).select('referralCode').lean();
    const allCoupons = await this.getAvailableCouponsForCheckout(items, userId);
    const referralCoupons = allCoupons.filter((coupon) => coupon.isReferralReward);
    const availableCoupons = allCoupons.filter((coupon) => !coupon.isReferralReward);

    return {
      items,
      addresses,
      defaultAddressId,
      summary,
      walletBalance,
      referralCode: user?.referralCode || '',
      referralCoupons,
      availableCoupons,
      allCoupons
    };
  };


  /** Apply coupon: validate and return updated summary. Only one coupon at a time (replaces any previous). */
  applyCoupon = async (userId, code) => {
    const items = await this.getCartItemsForCheckout(userId);
    if (!items.length) throw new Error('Your cart is empty');
    const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
    const coupon = await this.getValidCoupon(code, subtotal, userId);
    if (!coupon) throw new Error('Invalid or expired coupon, or minimum order value not met');
    const summary = this.buildSummary(items, coupon);
    return { summary, couponCode: coupon.code };
  };

  /** Remove coupon and return summary without discount. */
  removeCoupon = async (userId) => {
    const items = await this.getCartItemsForCheckout(userId);
    const summary = this.buildSummary(items);
    return { summary };
  };

  removeCheckoutItem = async (userId, itemId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) throw new Error('Cart not found');

    const item = cart.items.id(itemId);
    if (!item) throw new Error('Cart item not found');

    item.deleteOne();
    await cart.save();

    const pageData = await this.getCheckoutPageData(userId);
    return pageData;
  };

  addAddress = async (userId, addressData) => {
    const fullName = String(addressData.fullName || '').trim();
    const mobile = String(addressData.mobile || '').trim();
    const houseNo = String(addressData.houseNo || '').trim();
    const landmark = String(addressData.landmark || '').trim();
    const city = String(addressData.city || '').trim();
    const state = String(addressData.state || '').trim();
    const pincode = String(addressData.pincode || '').trim();
    const country = String(addressData.country || '').trim();
    const isDefault = addressData.isDefault === true || addressData.isDefault === 'true' || addressData.isDefault === 'on';

    if (!fullName || !mobile || !houseNo || !landmark || !city || !state || !pincode || !country) {
      throw new Error('All address fields are required');
    }

    if (!/^\d{10}$/.test(mobile)) throw new Error('Phone must be 10 digits');
    if (!/^\d{6}$/.test(pincode)) throw new Error('Pincode must be 6 digits');

    const newAddress = {
      name: fullName,
      phone: mobile,
      houseNo,
      landMark: landmark,
      city,
      state,
      country,
      pincode: Number(pincode),
      isDefault
    };

    let doc = await Address.findOne({ userId });
    if (!doc) {
      doc = new Address({
        userId,
        address: [{ ...newAddress, isDefault: true }]
      });
      await doc.save();
      return doc;
    }

    if (isDefault) {
      doc.address.forEach((addr) => {
        addr.isDefault = false;
      });
    } else if (!doc.address.some((addr) => addr.isDefault)) {
      newAddress.isDefault = true;
    }

    doc.address.push(newAddress);
    await doc.save();
    return doc;
  };

  updateAddress = async (userId, addressId, addressData) => {
    const doc = await Address.findOne({ userId });
    if (!doc) throw new Error('Address not found');

    const addr = doc.address.id(addressId);
    if (!addr) throw new Error('Address not found');

    const fullName = String(addressData.fullName || '').trim();
    const mobile = String(addressData.mobile || '').trim();
    const houseNo = String(addressData.houseNo || '').trim();
    const landmark = String(addressData.landmark || '').trim();
    const city = String(addressData.city || '').trim();
    const state = String(addressData.state || '').trim();
    const pincode = String(addressData.pincode || '').trim();
    const country = String(addressData.country || '').trim();
    const isDefault = addressData.isDefault === true || addressData.isDefault === 'true' || addressData.isDefault === 'on';

    if (!fullName || !mobile || !houseNo || !landmark || !city || !state || !pincode || !country) {
      throw new Error('All address fields are required');
    }

    if (!/^\d{10}$/.test(mobile)) throw new Error('Phone must be 10 digits');
    if (!/^\d{6}$/.test(pincode)) throw new Error('Pincode must be 6 digits');

    addr.name = fullName;
    addr.phone = mobile;
    addr.houseNo = houseNo;
    addr.landMark = landmark;
    addr.city = city;
    addr.state = state;
    addr.country = country;
    addr.pincode = Number(pincode);

    if (isDefault) {
      doc.address.forEach((item) => {
        item.isDefault = item._id.toString() === addressId.toString();
      });
    }

    await doc.save();
    return doc;
  };

  deleteAddress = async (userId, addressId) => {
    const doc = await Address.findOne({ userId });
    if (!doc) throw new Error('Address not found');

    const index = doc.address.findIndex((addr) => addr._id.toString() === addressId.toString());
    if (index === -1) throw new Error('Address not found');

    const wasDefault = !!doc.address[index].isDefault;
    doc.address.splice(index, 1);

    if (wasDefault && doc.address.length > 0) {
      doc.address[0].isDefault = true;
    }

    await doc.save();
    return doc;
  };

  /**
   * Create a Razorpay order for current cart (for online payment). Does not create DB order or clear cart.
   * @returns {{ razorpayOrderId, keyId, amount, currency, finalTotal } | null}
   */
  createRazorpayOrderForCheckout = async (userId, addressId, couponCode = '') => {
    if (!razorpayService.isRazorpayEnabled()) {
      throw new Error('Online payment is not configured. Please use Cash on Delivery.');
    }
    if (!addressId) {
      throw new Error('Please select shipping address');
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) throw new Error('Address not found');

    const selectedAddress = addressDoc.address.id(addressId);
    if (!selectedAddress) throw new Error('Selected address not found');
    if (!selectedAddress.houseNo) {
      throw new Error('Selected address is missing house number. Please edit address and try again.');
    }

    const items = await this.getCartItemsForCheckout(userId);
    if (!items.length) throw new Error('Your cart is empty');
    if (items.some((item) => item.outOfStock)) {
      throw new Error('Some items are out of stock. Please update cart before placing order.');
    }
    let summary = this.buildSummary(items);
    if (couponCode) {
      const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
      const coupon = await this.getValidCoupon(couponCode, subtotal, userId);
      if (coupon) summary = this.buildSummary(items, coupon);
    }
    const razorpayOrder = await razorpayService.createOrder(summary.finalTotal, `checkout_${userId}`);
    if (!razorpayOrder) throw new Error('Could not create payment order. Please try again.');
    return {
      razorpayOrderId: razorpayOrder.orderId,
      keyId: razorpayService.getRazorpayKeyId(),
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency || 'INR',
      finalTotal: summary.finalTotal
    };
  };

  /**
   * Verify Razorpay payment and place order (reserve stock, create order, clear cart).
   */
  verifyAndPlaceOrder = async (userId, orderData) => {
    const { addressId, razorpayOrderId, razorpayPaymentId, razorpaySignature, couponCode = '' } = orderData || {};
    if (!addressId) throw new Error('Please select shipping address');
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new Error('Invalid payment details. Please try again from checkout.');
    }
    const valid = razorpayService.verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!valid) throw new Error('Payment verification failed. Please try again.');

    return this.placeOrder(userId, { addressId, paymentMethod: 'razorpay', paymentStatus: 'Completed', couponCode });
  };

  placeOrder = async (userId, orderData) => {
    //const { addressId, paymentMethod = 'cod', paymentStatus = 'Pending', couponCode: orderCouponCode = '' } = orderData || {};
    const {
      addressId,
      paymentMethod = 'cod',
      paymentStatus: incomingPaymentStatus = '',
      couponCode: orderCouponCode = ''
    } = orderData || {};
    if (!addressId) throw new Error('Please select shipping address');
    const allowedMethods = ['cod', 'razorpay', 'wallet'];
    if (!allowedMethods.includes(paymentMethod)) {
      throw new Error('Selected payment method is not available. Please use Cash on Delivery, Wallet or Online Payment.');
    }

    const items = await this.getCartItemsForCheckout(userId);
    if (!items.length) throw new Error('Your cart is empty');
    if (items.some((item) => item.outOfStock)) {
      throw new Error('Some items are out of stock. Please update cart before placing order.');
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) throw new Error('Address not found');

    const selectedAddress = addressDoc.address.id(addressId);
    if (!selectedAddress) throw new Error('Selected address not found');
    if (!selectedAddress.houseNo) {
      throw new Error('Selected address is missing house number. Please edit address and try again.');
    }

    let summary = this.buildSummary(items);
    if (orderCouponCode) {
      const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
      const coupon = await this.getValidCoupon(orderCouponCode, subtotal, userId);
      if (coupon) {
        summary = this.buildSummary(items, coupon);
        await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
      }
    }

    if (paymentMethod === 'wallet') {
      const balance = await walletService.getBalance(userId);
      if (balance < summary.finalTotal) {
        throw new Error(`Insufficient wallet balance. Your balance is ₹${balance}, order total is ₹${summary.finalTotal}.`);
      }
    }

    const resolvedPaymentStatus =
      String(incomingPaymentStatus || '').trim() ||
      (paymentMethod === 'cod' ? 'Pending' : 'Completed');

    const reservedItems = await this.reserveStockForOrder(items);

    const orderItems = items.map((item) => {
      const original = Number(item.originalPrice) || 0;
      const sale = Number(item.price) || 0;
      const qty = Number(item.quantity) || 0;
      const offerLineTotal = Math.max(0, Math.round((original - sale) * qty));

      return {
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        brand: item.brand || 'N/A',
        image: item.image || '',
        color: item.color || '-',
        size: item.size || '-',
        quantity: qty,
        price: sale,
        originalPrice: original,
        offerLineTotal,
        itemTotal: item.itemTotal
      };
    });

    const offerDiscount = orderItems.reduce((sum, line) => sum + (line.offerLineTotal || 0), 0);

    if (paymentMethod === 'wallet') {
      await walletService.debit(userId, summary.finalTotal, '', 'Order payment');
    }

    try {
      const order = await Order.create({
        userId,
        items: orderItems,
        shippingAddress: {
          name: selectedAddress.name,
          phone: selectedAddress.phone,
          houseNo: selectedAddress.houseNo,
          city: selectedAddress.city,
          landMark: selectedAddress.landMark,
          state: selectedAddress.state,
          country: selectedAddress.country,
          pincode: Number(selectedAddress.pincode)
        },
        pricing: {
          totalItems: summary.totalItems,
          subtotal: summary.subtotal,
          shippingCharge: summary.shipping,
          tax: 0,
          couponCode: summary.couponCode,
          couponDiscount: summary.discount,
          offerDiscount,
          finalAmount: summary.finalTotal
        },
        orderStatus: 'processing',
        paymentMethod,
        //paymentStatus: paymentStatus || (paymentMethod === 'cod' ? 'Pending' : 'Completed'),
        paymentStatus: resolvedPaymentStatus,
        invoiceDate: new Date()
      });

      await Cart.updateOne({ userId }, { $set: { items: [] } });

      return { orderId: order.orderId };
    } catch (error) {
      if (paymentMethod === 'wallet') {
        await walletService.credit(userId, summary.finalTotal, '', 'Order creation failed refund');
      }
      await this.restoreReservedStock(reservedItems);
      throw error;
    }
  };

}

export default new CheckoutService();
