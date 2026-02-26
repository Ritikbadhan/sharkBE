const Order = require('../models/Order.model');

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { items, shippingAddress, paymentMethod, totalAmount, paymentId } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Order items required' });
      if (!paymentMethod) return res.status(400).json({ message: 'paymentMethod required' });
      if (totalAmount === undefined) return res.status(400).json({ message: 'totalAmount required' });

      const order = new Order({
        userId: req.user._id,
        items,
        shippingAddress,
        paymentMethod,
        totalAmount,
        paymentId
      });
      await order.save();
      return res.status(201).json({ message: 'Order placed', order });
    } catch (err) {
      console.error('Create order error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  myOrders: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
      return res.status(200).json({ orders });
    } catch (err) {
      console.error('My orders error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.findById(id).populate('userId', 'name email');
      if (!order) return res.status(404).json({ message: 'Order not found' });
      // allow owner or admin
      if (order.userId._id.toString() !== (req.user && req.user._id.toString()) && !(req.user && req.user.role === 'admin')) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      return res.status(200).json({ order });
    } catch (err) {
      console.error('Get order error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  updateStatus: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const { id } = req.params;
      const { orderStatus, paymentStatus } = req.body || {};
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      if (orderStatus) order.orderStatus = orderStatus;
      if (paymentStatus) order.paymentStatus = paymentStatus;

      await order.save();
      return res.status(200).json({ message: 'Order updated', order });
    } catch (err) {
      console.error('Update order status error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
