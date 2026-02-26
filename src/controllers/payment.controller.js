const Order = require('../models/Order.model');
const crypto = require('crypto');

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { orderId, paymentMethod } = req.body || {};
      if (!orderId || !paymentMethod) return res.status(400).json({ message: 'orderId and paymentMethod are required' });

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
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
      const { orderId, paymentId } = req.body || {};
      if (!orderId || !paymentId) return res.status(400).json({ message: 'orderId and paymentId are required' });

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // In production verify gateway signature; here we simply check matching paymentId
      if (order.paymentId !== paymentId) return res.status(400).json({ message: 'Invalid payment id' });

      order.paymentStatus = 'paid';
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
