import WishlistService from "../../service/user/wishlistService.js"
import UserService from "../../service/user/userService.js"
import logger from '../../logger.js';
class WishlistController {
  // GET /wishlist
  loadWishlist = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const user = await UserService.getUserById(userId);
      if (!user) return res.redirect('/pageNotFound');

      const cards = await WishlistService.getWishlistCards(userId);

      return res.render('wishlist', {
        user,
        wishlistCards: cards
      });
    } catch (error) {
      logger.error('Error loading wishlist:', error);
      return res.status(500).render('page-404');
    }
  };

  // POST /wishlist/add
  addToWishlist = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { productId } = req.body || {};
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product id is required' });
      }

      const result = await WishlistService.addToWishlist(userId, productId);
      return res.json({
        success: true,
        message: result.alreadyExists ? 'Product already in wishlist' : 'Added to wishlist'
      });
    } catch (error) {
      logger.error('Error adding to wishlist:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to add wishlist' });
    }
  };

  // DELETE /wishlist/remove/:productId
  removeFromWishlist = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { productId } = req.params || {};
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product id is required' });
      }

      await WishlistService.removeFromWishlist(userId, productId);
      return res.json({ success: true, message: 'Removed from wishlist' });
    } catch (error) {
      logger.error('Error removing wishlist item:', error);
      return res.status(500).json({ success: false, message: 'Failed to remove wishlist item' });
    }
  };

  // GET /wishlist/variants/:productId
  getVariantsForModal = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { productId } = req.params || {};
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product id is required' });
      }

      const variants = await WishlistService.getActiveVariantsForWishlistProduct(userId, productId);
      return res.json({ success: true, variants });
    } catch (error) {
      logger.error('Error loading variants for wishlist modal:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to fetch variants' });
    }
  };
}
export default new WishlistController()