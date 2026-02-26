const Order = require('../models/Order.model');
const crypto = require('crypto');
const mongoose = require('mongoose');

const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET;

function safeEqual(a, b) {
  const left = Buffer.from(a || '', 'utf8');
  const right = Buffer.from(b || '', 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { orderId, paymentMethod } = req.body || {};
      if (!orderId || !paymentMethod) return res.status(400).json({ message: 'orderId and paymentMethod are required' });
      if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: 'Invalid orderId' });

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      if (order.paymentStatus === 'paid') return res.status(400).json({ message: 'Order is already paid' });
      if (paymentMethod !== order.paymentMethod) {
        return res.status(400).json({ message: 'paymentMethod does not match the order paymentMethod' });
      }

      // In production integrate with payment gateway (Razorpay/Stripe/etc).
      // For now create a mock payment session and attach to the order.
      const paymentId = crypto.randomBytes(16).toString('hex');
      order.paymentId = paymentId;
      order.paymentStatus = 'pending';
      await order.save();

      const payment = {
        paymentId,
        amount: order.totalAmount,
        currency: 'USD',
        paymentMethod,
        status: 'pending'
      };

      return res.status(201).json({ message: 'Payment created', payment });
    } catch (err) {
      console.error('Create payment error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  verify: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { orderId, paymentId, signature } = req.body || {};
      if (!orderId || !paymentId || !signature) {
        return res.status(400).json({ message: 'orderId, paymentId and signature are required' });
      }
      if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: 'Invalid orderId' });
      if (!PAYMENT_WEBHOOK_SECRET) {
        return res.status(503).json({ message: 'Payment verification is not configured' });
      }

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      if (order.paymentStatus === 'paid') {
        return res.status(400).json({ message: 'Order is already paid' });
      }
      if (order.paymentId !== paymentId) return res.status(400).json({ message: 'Invalid payment id' });
      const expectedSignature = crypto
        .createHmac('sha256', PAYMENT_WEBHOOK_SECRET)
        .update(`${orderId}:${paymentId}`)
        .digest('hex');
      if (!safeEqual(expectedSignature, signature)) {
        return res.status(400).json({ message: 'Invalid payment signature' });
      }

      order.paymentStatus = 'paid';
      if (order.orderStatus === 'placed') order.orderStatus = 'confirmed';
      await order.save();

      return res.status(200).json({ message: 'Payment verified', orderId: order._id });
    } catch (err) {
      console.error('Verify payment error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  getByOrder: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { orderId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: 'Invalid orderId' });
      const order = await Order.findById(orderId).populate('userId', 'name email');
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      return res.status(200).json({ paymentId: order.paymentId, paymentStatus: order.paymentStatus, totalAmount: order.totalAmount });
    } catch (err) {
      console.error('Get payment error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
