import Razorpay from 'razorpay';
import crypto from 'crypto';
import paymentConfig from '../../config/razorpay.js';

const getInstance = () => {
  if (!paymentConfig.razorpay.enabled) return null;
  return new Razorpay({
    key_id: paymentConfig.razorpay.key_id,
    key_secret: paymentConfig.razorpay.key_secret
  });
};


export const createOrder = async (amountInr, receipt = '') => {
  const instance = getInstance();
  if (!instance) return null;

  const amountPaise = Math.round(Number(amountInr) * 100);
  if (amountPaise < 100) return null;

  try {
    const razorpayOrder = await instance.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: receipt || `rcpt_${Date.now()}`
    });
    return {
      orderId: razorpayOrder.id,
      amount: amountPaise,
      currency: razorpayOrder.currency || 'INR'
    };
  } catch {
    return null;
  }
};


export const verifyPayment = (razorpayOrderId, razorpayPaymentId, signature) => {
  if (!paymentConfig.razorpay.enabled || !razorpayOrderId || !razorpayPaymentId || !signature) {
    return false;
  }
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', paymentConfig.razorpay.key_secret)
    .update(body)
    .digest('hex');
  return expected === signature;
};

export const isRazorpayEnabled = () => paymentConfig.razorpay.enabled;
export const getRazorpayKeyId = () => paymentConfig.razorpay.key_id;
