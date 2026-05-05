import WalletService from "../../service/user/walletService.js";
import * as razorpayService from '../../service/payment/razorpayService.js';
import UserService from '../../service/user/userService.js';
import logger from '../../logger.js';

class WalletController {
  loadWalletPage = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const user = await UserService.getUserById(userId);
      if (!user) return res.redirect('/pageNotFound');

      const page = Math.max(1, Number(req.query?.page) || 1);
      const walletData = await WalletService.getWalletSummary(userId, page, 8);

      return res.render('wallet', {
        user,
        balance: Number(walletData.balance || 0),
        transactions: walletData.transactions || [],
        pagination: walletData.pagination,
        razorpayEnabled: razorpayService.isRazorpayEnabled(),
        razorpayKeyId: razorpayService.getRazorpayKeyId(),
        activeItem: 'wallet'
      });
    } catch (error) {
      logger.error('Error loading wallet page:', error);
      return res.status(500).render('page-404');
    }
  };

  addMoney = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });
      if (!razorpayService.isRazorpayEnabled()) {
        return res.status(400).json({ success: false, message: 'Razorpay is not configured' });
      }

      const amount = Number(req.body?.amount || 0);
      if (!Number.isFinite(amount) || amount < 10 || amount > 200000) {
        return res.status(400).json({ success: false, message: 'Enter a valid amount between ₹10 and ₹200000' });
      }

      const order = await razorpayService.createOrder(amount, `wallet_${Date.now()}`);
      if (!order) return res.status(500).json({ success: false, message: 'Failed to create payment order' });

      req.session.pendingWalletTopup = {
        razorpayOrderId: order.orderId,
        amount: Number(amount.toFixed(2)),
        createdAt: Date.now()
      };

      return res.json({
        success: true,
        keyId: razorpayService.getRazorpayKeyId(),
        razorpayOrderId: order.orderId,
        amount: order.amount,
        currency: order.currency || 'INR',
        displayAmount: Number(amount.toFixed(2))
      });
    } catch (error) {
      logger.error('Error creating wallet add-money order:', error);
      return res.status(500).json({ success: false, message: 'Failed to initiate add money' });
    }
  };

  verifyPayment = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ success: false, message: 'Invalid payment data' });
      }

      const pending = req.session.pendingWalletTopup || null;
      if (!pending || pending.razorpayOrderId !== razorpayOrderId) {
        return res.status(400).json({ success: false, message: 'Payment session mismatch. Please try again.' });
      }

      const valid = razorpayService.verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      if (!valid) {
        return res.status(400).json({ success: false, message: 'Payment verification failed' });
      }

      const newBalance = await WalletService.credit(
        userId,
        pending.amount,
        pending.razorpayOrderId,
        'Added via Razorpay'
      );
      req.session.pendingWalletTopup = null;

      return res.json({
        success: true,
        message: 'Money added to wallet successfully',
        balance: Number(newBalance || 0)
      });
    } catch (error) {
      logger.error('Error verifying wallet topup:', error);
      return res.status(500).json({ success: false, message: 'Failed to verify payment' });
    }
  };
  /* loadWalletPage = async (req, res) => {
     try {
       const userId = req.session?.user;
       if (!userId) return res.redirect('/login');
 
       const user = await UserService.getUserById(userId);
       if (!user) return res.redirect('/pageNotFound');
 
       const wallet = await WalletService.getOrCreateWallet(userId);
       const transactions = (wallet.transactions || []).slice().reverse().slice(0, 50);
 
       return res.render('wallet', {
         user,
         balance: Number(wallet.balance || 0),
         transactions,
         activeItem: 'wallet'
       });
     } catch (error) {
       logger.error('Error loading wallet page:', error);
       return res.status(500).render('page-404');
     }
   };*/
}

export default new WalletController();