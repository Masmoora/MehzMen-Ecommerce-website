//import User from '../../models/userSchema.js';
import Wallet from '../../models/walletSchema.js';

class WalletService{
    getOrCreateWallet = async (userId) => {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }
    return wallet;
  };

  getBalance = async (userId) => {
    const wallet = await this.getOrCreateWallet(userId);
    return Number(wallet.balance || 0);
  };

  addTransaction = async (userId, type, amount, orderId = '', reason = '') => {
    const wallet = await this.getOrCreateWallet(userId);
    wallet.transactions.push({
      type,
      amount: Number(amount),
      orderId: String(orderId),
      reason: String(reason)
    });
    if (type === 'credit') {
      wallet.balance = Number(wallet.balance || 0) + Number(amount);
    } else {
      wallet.balance = Math.max(0, Number(wallet.balance || 0) - Number(amount));
    }
    await wallet.save();
    return wallet.balance;
  };

  credit = async (userId, amount, orderId = '', reason = '') => {
    const amt = Math.max(0, Number(amount));
    if (amt === 0) return await this.getBalance(userId);
    return await this.addTransaction(userId, 'credit', amt, orderId, reason);
  };

  debit = async (userId, amount, orderId = '', reason = '') => {
    const amt = Math.max(0, Number(amount));
    if (amt === 0) return await this.getBalance(userId);
    const balance = await this.getBalance(userId);
    if (balance < amt) throw new Error('Insufficient wallet balance');
    return await this.addTransaction(userId, 'debit', amt, orderId, reason);
  };

  /** Refund amount to wallet (for cancel/return). Idempotent by orderId+reason if needed. */
  refundToWallet = async (userId, amount, orderId, reason = 'Refund') => {
    if (!userId || amount <= 0) return;
    await this.credit(userId, amount, orderId, reason);
  };;
}
export default new WalletService()