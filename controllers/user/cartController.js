import CartService from "../../service/user/cartService.js"
import UserService from "../../service/user/userService.js"
import logger from '../../logger.js';

class CartController{
  // GET /cart
  loadCart = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const user = await UserService.getUserById(userId);
      if (!user) return res.redirect('/pageNotFound');

      const cartData = await CartService.getCartPageData(userId);
      return res.render('cart', {
        user,
        cartItems: cartData.items,
        summary: cartData.summary
      });
    } catch (error) {
      logger.error('Error loading cart:', error);
      return res.status(500).render('page-404');
    }
  };

  // POST /cart/add
  addToCart = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { productId, variantId, quantity = 1 } = req.body || {};
      if (!productId || !variantId) {
        return res.status(400).json({ success: false, message: 'Product and variant are required' });
      }

      const cartData = await CartService.addToCart(userId, productId, variantId, quantity);
      return res.json({ success: true, message: 'Added to cart', cart: cartData });
    } catch (error) {
      logger.error('Error adding to cart:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to add cart' });
    }
  };

  // PATCH /cart/update-quantity
  updateQuantity = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { itemId, quantity } = req.body || {};
      if (!itemId || quantity === undefined) {
        return res.status(400).json({ success: false, message: 'Item id and quantity are required' });
      }

      const cartData = await CartService.updateQuantity(userId, itemId, quantity);
      return res.json({ success: true, message: 'Quantity updated', cart: cartData });
    } catch (error) {
      logger.error('Error updating cart quantity:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to update quantity' });
    }
  };

  // DELETE /cart/remove/:itemId
  removeItem = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { itemId } = req.params || {};
      if (!itemId) {
        return res.status(400).json({ success: false, message: 'Item id is required' });
      }

      const cartData = await CartService.removeItem(userId, itemId);
      return res.json({ success: true, message: 'Item removed', cart: cartData });
    } catch (error) {
      logger.error('Error removing cart item:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to remove item' });
    }
  };

}
export default new CartController()