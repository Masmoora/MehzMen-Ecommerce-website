import mongoose from 'mongoose';

const { Schema } = mongoose;

const transactionSchema = new Schema(
  {
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true, min: 0 },
    orderId: { type: String, default: '' },
    reason: { type: String, default: '' }
  },
  { timestamps: true, _id: true }
);

const walletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    balance: { type: Number, default: 0, min: 0 },
    transactions: { type: [transactionSchema], default: [] }
  },
  { timestamps: true }
);

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;
