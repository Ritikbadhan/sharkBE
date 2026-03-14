const Order = require('../models/Order.model');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { getRazorpayConfig, isRazorpayConfigured, getRazorpayInstance } = require('../config/razorpay');

const DEFAULT_CURRENCY = (process.env.RAZORPAY_CURRENCY || 'INR').toUpperCase();

function safeEqual(a, b) {
  const left = Buffer.from(a || '', 'utf8');
  const right = Buffer.from(b || '', 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function toSubunit(amount) {
  return Math.max(0, Math.round(Number(amount || 0) * 100));
}

module.exports = {
  config: async (req, res) => {
    try {
      const { keyId } = getRazorpayConfig();
      return res.status(200).json({
        provider: 'razorpay',
        keyId: keyId || null,
        currency: DEFAULT_CURRENCY,
        configured: isRazorpayConfigured()
      });
    } catch (err) {
      console.error('Payment config error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { orderId, paymentMethod } = req.body || {};
      if (!orderId || !paymentMethod) return res.status(400).json({ message: 'orderId and paymentMethod are required' });
      if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: 'Invalid orderId' });
      if (String(paymentMethod).toUpperCase() !== 'RAZORPAY') {
        return res.status(400).json({ message: 'Only RAZORPAY is supported by this endpoint' });
      }
      if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: 'Razorpay is not configured' });
      }

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      if (order.paymentStatus === 'paid') return res.status(400).json({ message: 'Order is already paid' });
      if (String(paymentMethod).toUpperCase() !== String(order.paymentMethod || '').toUpperCase()) {
        return res.status(400).json({ message: 'paymentMethod does not match the order paymentMethod' });
      }

      const razorpay = getRazorpayInstance();
      const gatewayOrder = await razorpay.orders.create({
        amount: toSubunit(order.totalAmount),
        currency: DEFAULT_CURRENCY,
        receipt: String(order._id),
        notes: {
          appOrderId: String(order._id),
          userId: String(order.userId)
        }
      });

      order.paymentGatewayOrderId = gatewayOrder.id;
      order.paymentStatus = 'pending';
      order.paymentCurrency = gatewayOrder.currency || DEFAULT_CURRENCY;
      await order.save();

      const payment = {
        orderId: order._id,
        razorpayOrderId: gatewayOrder.id,
        amount: order.totalAmount,
        amountSubunit: gatewayOrder.amount,
        currency: gatewayOrder.currency || DEFAULT_CURRENCY,
        paymentMethod: 'RAZORPAY',
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
      const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
      if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ message: 'orderId, razorpayOrderId, razorpayPaymentId and razorpaySignature are required' });
      }
      if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: 'Invalid orderId' });
      if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: 'Razorpay is not configured' });
      }

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      if (order.paymentStatus === 'paid') {
        return res.status(400).json({ message: 'Order is already paid' });
      }
      if (order.paymentGatewayOrderId !== razorpayOrderId) {
        return res.status(400).json({ message: 'Invalid razorpay order id' });
      }
      const { keySecret } = getRazorpayConfig();
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
      if (!safeEqual(expectedSignature, razorpaySignature)) {
        return res.status(400).json({ message: 'Invalid payment signature' });
      }

      order.paymentId = razorpayPaymentId;
      order.paymentStatus = 'paid';
      if (order.orderStatus === 'placed') order.orderStatus = 'confirmed';
      await order.save();

      return res.status(200).json({ message: 'Payment verified', orderId: order._id, paymentId: order.paymentId });
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

      return res.status(200).json({
        paymentId: order.paymentId,
        paymentGatewayOrderId: order.paymentGatewayOrderId || null,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        currency: order.paymentCurrency || DEFAULT_CURRENCY
      });
    } catch (err) {
      console.error('Get payment error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
