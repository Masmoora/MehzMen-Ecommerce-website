import WalletService from "../../service/user/walletService.js";

import UserService from '../../service/user/userService.js';
import logger from '../../logger.js';

class WalletController {
  loadWalletPage = async (req, res) => {
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
  };
}

export default new WalletController();