import Cart from "../../models/cartSchema.js"
import Product from '../../models/productSchema.js';
import ProductVariant from '../../models/productVariantSchema.js';
import Category from "../../models/categorySchema.js";
import Wishlist from "../../models/wishlistSchema.js";
const MAX_QTY = 5;
const SHIPPING_FLAT = 50;
class CartService{
    toValidQty = (quantity) => {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new Error('Quantity must be a whole number starting from 1');
    }
    return qty;
  };

  // Common product + variant validation for add/update actions
  validateProductAndVariant = async (productId, variantId) => {
    const product = await Product.findById(productId).lean();
    if (!product) throw new Error('Product not found');
    if (product.isBlocked || product.status !== 'available') {
      throw new Error('Product is not available');
    }

    const category = await Category.findById(product.category).lean();
    // Supports both "isBlocked" and "isListed" style categories
    const categoryBlocked = category
      ? category.isBlocked === true || category.isListed === false
      : true;
    if (categoryBlocked) throw new Error('Product category is blocked');

    const variant = await ProductVariant.findOne({
      _id: variantId,
      productId: productId,
      isActive: true
    }).lean();
    if (!variant) throw new Error('Product variant not found');
    if (variant.stock <= 0) throw new Error('Product is out of stock');

    return { product, variant };
  };

  addToCart = async (userId, productId, variantId, quantity = 1) => {
    const qtyToAdd = this.toValidQty(quantity);
    if (qtyToAdd > MAX_QTY) throw new Error(`Maximum quantity is ${MAX_QTY}`);

    const { variant } = await this.validateProductAndVariant(productId, variantId);

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existingItem = cart.items.find(
      (item) =>
        item.productId.toString() === productId.toString() &&
        item.variantId.toString() === variantId.toString()
    );

    if (existingItem) {
      const nextQty = existingItem.quantity + qtyToAdd;
      if (nextQty > MAX_QTY) throw new Error(`Maximum quantity is ${MAX_QTY}`);
      if (nextQty > variant.stock) throw new Error('Requested quantity exceeds stock');

      existingItem.quantity = nextQty;
      existingItem.basePrice = variant.price;
      existingItem.salePrice = variant.price;
      existingItem.discount = 0;
      existingItem.total = variant.price * nextQty;
    } else {
      if (qtyToAdd > variant.stock) throw new Error('Requested quantity exceeds stock');
      cart.items.push({
        productId,
        variantId,
        quantity: qtyToAdd,
        basePrice: variant.price,
        salePrice: variant.price,
        discount: 0,
        total: variant.price * qtyToAdd
      });
    }

    await cart.save();

    // Requirement: remove product from wishlist after successful cart add
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    );

    return this.getCartPageData(userId);
  };

  updateQuantity = async (userId, itemId, quantity) => {
    const qty = this.toValidQty(quantity);
    if (qty > MAX_QTY) throw new Error(`Maximum quantity is ${MAX_QTY}`);

    const cart = await Cart.findOne({ userId });
    if (!cart) throw new Error('Cart not found');

    const item = cart.items.id(itemId);
    if (!item) throw new Error('Cart item not found');

    const variant = await ProductVariant.findById(item.variantId).lean();
    if (!variant || !variant.isActive) throw new Error('Variant not available');
    if (qty > variant.stock) throw new Error('Requested quantity exceeds stock');

    item.quantity = qty;
    item.basePrice = variant.price;
    item.salePrice = variant.price;
    item.discount = 0;
    item.total = variant.price * qty;
    await cart.save();

    return this.getCartPageData(userId);
  };

  removeItem = async (userId, itemId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) return this.getEmptyCartData();

    const item = cart.items.id(itemId);
    if (item) item.deleteOne();
    await cart.save();

    return this.getCartPageData(userId);
  };

  getEmptyCartData = () => ({
    items: [],
    summary: {
      totalItems: 0,
      subtotal: 0,
      discount: 0,
      shipping: SHIPPING_FLAT,
      finalTotal: SHIPPING_FLAT
    }
  });

  // Page data for cart.ejs
  getCartPageData = async (userId) => {
    const cart = await Cart.findOne({ userId })
      .populate('items.productId')
      .populate('items.variantId')
      .lean();

    if (!cart || !cart.items?.length) return this.getEmptyCartData();

    const items = cart.items.map((item) => {
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
        productId: product?._id?.toString(),
        variantId: variant?._id?.toString(),
        productName: product?.name || 'Product',
        image: variant?.images?.[0] || '',
        color: variant?.color || '-',
        size: variant?.size || '-',
        price: item.salePrice,
        quantity: item.quantity,
        stock,
        lineTotal: item.salePrice * item.quantity,
        outOfStock
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const discount = 0;
    const finalTotal = subtotal - discount + SHIPPING_FLAT;

    return {
      items,
      summary: {
        totalItems,
        subtotal,
        discount,
        shipping: SHIPPING_FLAT,
        finalTotal
      }
    };
  };

}
export default new CartService()