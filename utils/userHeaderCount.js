import Cart from '../models/cartSchema.js';
import Wishlist from '../models/wishlistSchema.js';

const userHeaderCounts = async (req, res, next) => {
  try {
    res.locals.cartItemCount = 0;
    res.locals.wishlistItemCount = 0;

    const userId = req.session?.user;
    if (!userId) return next();

    const [cart, wishlist] = await Promise.all([
      Cart.findOne({ userId }).select('items.quantity').lean(),
      Wishlist.findOne({ userId }).select('products').lean()
    ]);

    const cartCount = (cart?.items || []).reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );
    const wishlistCount = (wishlist?.products || []).length;

    res.locals.cartItemCount = cartCount;
    res.locals.wishlistItemCount = wishlistCount;

    return next();
  } catch (error) {
    return next();
  }
};

export default userHeaderCounts;
