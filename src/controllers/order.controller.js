const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const mongoose = require('mongoose');

function parseQuantity(value) {
  const qty = Number(value);
  return Number.isFinite(qty) ? Math.floor(qty) : NaN;
}

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { items, shippingAddress, paymentMethod, paymentId, invoiceUrl, trackingUrl } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Order items required' });
      if (!paymentMethod) return res.status(400).json({ message: 'paymentMethod required' });

      const normalized = items.map((it) => ({
        productId: it && it.productId,
        quantity: parseQuantity((it && it.quantity) ?? (it && it.qty)),
        size: it && it.size,
        color: it && it.color
      }));
      if (normalized.some((it) => !it.productId || !it.quantity || it.quantity < 1)) {
        return res.status(400).json({ message: 'Each item must contain productId and a positive integer quantity' });
      }
      if (normalized.some((it) => !mongoose.Types.ObjectId.isValid(it.productId))) {
        return res.status(400).json({ message: 'One or more productIds are invalid' });
      }

      const productIds = [...new Set(normalized.map((it) => it.productId.toString()))];
      const products = await Product.find({ _id: { $in: productIds } }).select('_id name price images');
      if (products.length !== productIds.length) {
        return res.status(400).json({ message: 'One or more products are invalid' });
      }

      const productById = new Map(products.map((p) => [p._id.toString(), p]));
      let totalAmount = 0;
      const trustedItems = normalized.map((it) => {
        const product = productById.get(it.productId.toString());
        const linePrice = product.price;
        totalAmount += linePrice * it.quantity;
        return {
          productId: product._id,
          name: product.name,
          quantity: it.quantity,
          size: it.size,
          color: it.color,
          price: linePrice,
          image: Array.isArray(product.images) && product.images.length ? product.images[0] : undefined
        };
      });

      const order = new Order({
        userId: req.user._id,
        items: trustedItems,
        shippingAddress,
        paymentMethod,
        totalAmount,
        paymentId,
        invoiceUrl,
        trackingUrl,
        returnEligible: true
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
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
      const order = await Order.findById(id).populate('userId', 'name email');
      if (!order) return res.status(404).json({ message: 'Order not found' });
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
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
      const { orderStatus, paymentStatus, invoiceUrl, trackingUrl, returnEligible } = req.body || {};
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      if (orderStatus) order.orderStatus = orderStatus;
      if (paymentStatus) order.paymentStatus = paymentStatus;
      if (invoiceUrl !== undefined) order.invoiceUrl = invoiceUrl;
      if (trackingUrl !== undefined) order.trackingUrl = trackingUrl;
      if (returnEligible !== undefined) order.returnEligible = Boolean(returnEligible);

      await order.save();
      return res.status(200).json({ message: 'Order updated', order });
    } catch (err) {
      console.error('Update order status error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
