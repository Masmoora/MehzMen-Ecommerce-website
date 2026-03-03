import Address from "../../models/addressSchema.js";
import Cart from "../../models/cartSchema.js";
import Order from "../../models/orderSchema.js";
import ProductVariant from "../../models/productVariantSchema.js";
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
    populate: {
      path: 'brand',
      select: 'name'
    }
  })
  .populate('items.variantId')
  .lean();

    if (!cart || !cart.items?.length) return [];

    return cart.items.map((item) => {
      const product = item.productId;
      const variant = item.variantId;
      const stock = variant?.stock || 0;

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
        price: item.salePrice,
        itemTotal: item.salePrice * item.quantity,
        outOfStock
      };
    });
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

  buildSummary = (items) => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
    const discount = 0;
    const finalTotal = Math.max(0, subtotal - discount + (items.length ? SHIPPING_FLAT : 0));

    return {
      totalItems,
      subtotal,
      shipping: items.length ? SHIPPING_FLAT : 0,
      discount,
      couponCode: '',
      finalTotal
    };
  };

  getCheckoutPageData = async (userId) => {
    const items = await this.getCartItemsForCheckout(userId);
    const { addresses, defaultAddressId } = await this.getAddressData(userId);
    const summary = this.buildSummary(items);

    return { items, addresses, defaultAddressId, summary };
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

  placeOrder = async (userId, orderData) => {
    const { addressId, paymentMethod = 'cod' } = orderData || {};
    if (!addressId) throw new Error('Please select shipping address');
    if (paymentMethod !== 'cod') {
      throw new Error('Selected payment method is not available right now. Please use Cash on Delivery.');
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

    const summary = this.buildSummary(items);
    const reservedItems = await this.reserveStockForOrder(items);

    const orderItems = items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      brand: item.brand || 'N/A',
      image: item.image || '',
      color: item.color || '-',
      size: item.size || '-',
      quantity: item.quantity,
      price: item.price,
      itemTotal: item.itemTotal
    }));

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
          finalAmount: summary.finalTotal
        },
        orderStatus: 'processing',
        paymentMethod,
        paymentStatus: 'Pending',
        invoiceDate: new Date()
      });

      await Cart.updateOne({ userId }, { $set: { items: [] } });

      return { orderId: order.orderId };
    } catch (error) {
      await this.restoreReservedStock(reservedItems);
      throw error;
    }
  };

}

export default new CheckoutService();