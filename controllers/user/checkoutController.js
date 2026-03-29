import UserService from '../../service/user/userService.js';
import CheckoutService from '../../service/user/checkoutService.js';
import logger from '../../logger.js';
class CheckoutController{
    loadCheckout = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const user = await UserService.getUserById(userId);
      if (!user) return res.redirect('/pageNotFound');

      const data = await CheckoutService.getCheckoutPageData(userId);

      return res.render('checkout', {
        user,
        checkoutItems: data.items,
        addresses: data.addresses,
        defaultAddressId: data.defaultAddressId,
        summary: data.summary,
        walletBalance: data.walletBalance ?? 0,
        availableCoupons: data.availableCoupons || [],
         referralCode: data.referralCode || '',
        referralCoupons: data.referralCoupons || [],
        availableCoupons: data.availableCoupons || [],
        allCoupons: data.allCoupons || []
      });
    } catch (error) {
      logger.error('Error loading checkout page:', error);
      return res.status(500).render('page-404');
    }
  };

  removeCheckoutItem = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { itemId } = req.params || {};
      if (!itemId) {
        return res.status(400).json({ success: false, message: 'Item id is required' });
      }

      const data = await CheckoutService.removeCheckoutItem(userId, itemId);
      return res.json({ success: true, message: 'Item removed', checkout: data });
    } catch (error) {
      logger.error('Error removing checkout item:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to remove item' });
    }
  };

  addAddress = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const addressData = req.body || {};
      await CheckoutService.addAddress(userId, addressData);
      return res.status(201).json({ success: true, message: 'Address added successfully' });
    } catch (error) {
      logger.error('Error adding checkout address:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to add address' });
    }
  };

  updateAddress = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { addressId } = req.params || {};
      if (!addressId) {
        return res.status(400).json({ success: false, message: 'Address id is required' });
      }

      const addressData = req.body || {};
      await CheckoutService.updateAddress(userId, addressId, addressData);
      return res.json({ success: true, message: 'Address updated successfully' });
    } catch (error) {
      logger.error('Error updating checkout address:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to update address' });
    }
  };

  deleteAddress = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { addressId } = req.params || {};
      if (!addressId) {
        return res.status(400).json({ success: false, message: 'Address id is required' });
      }

      await CheckoutService.deleteAddress(userId, addressId);
      return res.json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
      logger.error('Error deleting checkout address:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to delete address' });
    }
  };

  placeOrder = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const orderData = req.body || {};
      const result = await CheckoutService.placeOrder(userId, orderData);
      return res.json({
        success: true,
        message: 'Order placed successfully',
        orderId: result.orderId,redirectUrl: `/orders/success?orderId=${encodeURIComponent(result.orderId)}`
      });
        
    } catch (error) {
      logger.error('Error placing order:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to place order' });
    }
  };

  createRazorpayOrder = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { addressId, couponCode = '' } = req.body || {};
      if (!addressId) return res.status(400).json({ success: false, message: 'Address is required' });

      const data = await CheckoutService.createRazorpayOrderForCheckout(userId, addressId, couponCode);
      return res.json({ success: true, ...data });
    } catch (error) {
      logger.error('Error creating Razorpay order:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to create payment order' });
    }
  };

  applyCoupon = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { couponCode } = req.body || {};
      if (!couponCode || !String(couponCode).trim()) {
        return res.status(400).json({ success: false, message: 'Coupon code is required' });
      }

      const result = await CheckoutService.applyCoupon(userId, couponCode);
      return res.json({ success: true, message: 'Coupon applied', summary: result.summary, couponCode: result.couponCode });
    } catch (error) {
      logger.error('Error applying coupon:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to apply coupon' });
    }
  };

  removeCoupon = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const result = await CheckoutService.removeCoupon(userId);
      return res.json({ success: true, message: 'Coupon removed', summary: result.summary });
    } catch (error) {
      logger.error('Error removing coupon:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to remove coupon' });
    }
  };

  verifyPayment = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const { addressId, razorpayOrderId, razorpayPaymentId, razorpaySignature, couponCode = '' } = req.body || {};
      if (!addressId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.redirect('/orders/failure');
      }

      const result = await CheckoutService.verifyAndPlaceOrder(userId, {
        addressId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        couponCode
      });
      return res.redirect(`/orders/success?orderId=${encodeURIComponent(result.orderId)}`);
    } catch (error) {
      logger.error('Error verifying payment:', error);
      return res.redirect('/orders/failure');
    }
  };
}
export default new CheckoutController()