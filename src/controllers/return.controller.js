const ReturnRequest = require('../models/Return.model');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const mongoose = require('mongoose');

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { orderId, productId, reason, comment } = req.body || {};
      if (!reason) return res.status(400).json({ message: 'reason is required' });

      if (orderId && !mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: 'Invalid orderId' });
      if (productId && !mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid productId' });

      if (orderId) {
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });
      }

      if (productId) {
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Product not found' });
      }

      const request = new ReturnRequest({
        userId: req.user._id,
        orderId,
        productId,
        reason,
        comment
      });
      await request.save();

      return res.status(201).json({ message: 'Return request created', returnRequest: request });
    } catch (err) {
      console.error('Create return request error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  myReturns: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const requests = await ReturnRequest.find({ userId: req.user._id }).sort({ createdAt: -1 });
      return res.status(200).json({ returns: requests });
    } catch (err) {
      console.error('List returns error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
