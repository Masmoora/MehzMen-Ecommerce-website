import Wishlist from "../../models/wishlistSchema.js"
import Product from '../../models/productSchema.js';
import ProductVariant from '../../models/productVariantSchema.js';
class WishlistService {
  // Get wishlist cards for page (with cheapest active variant details)
  // Get wishlist cards for page (with cheapest active variant details)
  getWishlistCards = async (userId) => {
    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: 'products.productId',
        select: 'name isBlocked status'
      })
      .lean();

    if (!wishlist || !wishlist.products?.length) return [];

    const productIds = wishlist.products
      .map((item) => item.productId?._id)
      .filter(Boolean);

    const variants = await ProductVariant.find({
      productId: { $in: productIds },
      isActive: true
    }).lean();

    // Build cheapest variant map by product id
    const cheapestByProduct = new Map();
    for (const variant of variants) {
      const key = variant.productId?.toString();
      if (!key) continue;
      const existing = cheapestByProduct.get(key);
      if (!existing || variant.price < existing.price) {
        cheapestByProduct.set(key, variant);
      }
    }

    const cards = [];
    for (const item of wishlist.products) {
      const product = item.productId;
      if (!product) continue;
      if (product.isBlocked || product.status !== 'available') continue;

      const productKey = product._id.toString();
      const cheapest = cheapestByProduct.get(productKey);
      if (!cheapest) continue;

      // Product is available if ANY active variant has stock > 0
      const hasStock = variants.some(
        (v) => v.productId?.toString() === productKey && v.stock > 0
      );

      cards.push({
        productId: productKey,
        name: product.name,
        image: cheapest.images?.[0] || '',
        price: cheapest.price,
        hasStock
      });
    }

    return cards;
  };

  // Add only productId to wishlist
  addToWishlist = async (userId, productId) => {
    const product = await Product.findById(productId).lean();
    if (!product) throw new Error('Product not found');
    if (product.isBlocked || product.status !== 'available') {
      throw new Error('Product is not available');
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: [{ productId }]
      });
      await wishlist.save();
      return { alreadyExists: false };
    }

    const exists = wishlist.products.some(
      (item) => item.productId.toString() === productId.toString()
    );
    if (exists) return { alreadyExists: true };

    wishlist.products.push({ productId });
    await wishlist.save();
    return { alreadyExists: false };
  };

  removeFromWishlist = async (userId, productId) => {
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    );
    return true;
  };

  // For modal: return active variants of product in wishlist
  getActiveVariantsForWishlistProduct = async (userId, productId) => {
    const wishlist = await Wishlist.findOne({
      userId,
      'products.productId': productId
    }).lean();

    if (!wishlist) throw new Error('Product not found in wishlist');

    const variants = await ProductVariant.find({
      productId: productId,
      isActive: true
    })
      .select('_id color size price images stock')
      .lean();

    return variants.map((variant) => ({
      _id: variant._id.toString(),
      color: variant.color,
      size: variant.size,
      price: variant.price,
      stock: variant.stock,
      image: variant.images?.[0] || '',
      images: variant.images || []
    }));
  };
}
export default new WishlistService()