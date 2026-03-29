import User from '../../models/userSchema.js';
import Wallet from '../../models/walletSchema.js';

class WalletService{
normalizeAmount = (amount) => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100) / 100;
  };

  getOrCreateWallet = async (userId) => {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }
    return wallet;
  };

  syncUserBalance = async (userId, balance) => {
    await User.updateOne({ _id: userId }, { $set: { wallet: Number(balance || 0) } });
  };

  getBalance = async (userId) => {
    const wallet = await this.getOrCreateWallet(userId);
    const balance = Number(wallet.balance || 0);
    await this.syncUserBalance(userId, balance);
    return balance;
  };

  getWalletSummary = async (userId, page = 1, limit = 8) => {
    const wallet = await this.getOrCreateWallet(userId);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 8));

    const sorted = [...(wallet.transactions || [])].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const totalItems = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit));
    const currentPage = Math.min(safePage, totalPages);
    const start = (currentPage - 1) * safeLimit;
    const transactions = sorted.slice(start, start + safeLimit);
    const balance = Number(wallet.balance || 0);
    await this.syncUserBalance(userId, balance);

    return {
      balance,
      transactions,
      pagination: {
        page: currentPage,
        limit: safeLimit,
        totalItems,
        totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages
      }
    };
  };

  addTransaction = async (userId, type, amount, orderId = '', reason = '') => {
    const wallet = await this.getOrCreateWallet(userId);
    const amt = this.normalizeAmount(amount);
    if (amt <= 0) return Number(wallet.balance || 0);

    if (type === 'debit') {
      if (Number(wallet.balance || 0) < amt) throw new Error('Insufficient wallet balance');
      wallet.balance = this.normalizeAmount(Number(wallet.balance || 0) - amt);
    } else {
      wallet.balance = this.normalizeAmount(Number(wallet.balance || 0) + amt);
    }

    wallet.transactions.push({
      type,
      amount: amt,
      orderId: String(orderId || ''),
      reason: String(reason || '')
    });
    await wallet.save();
    await this.syncUserBalance(userId, wallet.balance);
    return Number(wallet.balance || 0);
  };

  credit = async (userId, amount, orderId = '', reason = 'Wallet credited') => {
    return this.addTransaction(userId, 'credit', amount, orderId, reason);
  };

  debit = async (userId, amount, orderId = '', reason = 'Wallet debited') => {
    return this.addTransaction(userId, 'debit', amount, orderId, reason);
  };

  refundToWallet = async (userId, amount, orderId = '', reason = 'Refund') => {
    return this.credit(userId, amount, orderId, reason);
  };
}
export default new WalletService()