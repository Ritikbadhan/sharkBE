const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');
const mongoose = require('mongoose');

function parseQuantity(value, fallback = 1) {
  const qty = value === undefined ? fallback : Number(value);
  return Number.isFinite(qty) ? Math.floor(qty) : NaN;
}

module.exports = {
  getCart: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      let cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) cart = await Cart.create({ userId: req.user._id, items: [] });
      return res.status(200).json({ cart });
    } catch (err) {
      console.error('Get cart error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  addItem: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId, quantity = 1 } = req.body || {};
      if (!productId) return res.status(400).json({ message: 'productId is required' });
      if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid productId' });
      const qty = parseQuantity(quantity, 1);
      if (!qty || qty < 1) return res.status(400).json({ message: 'quantity must be a positive integer' });

      const product = await Product.findById(productId).select('price');
      if (!product) return res.status(404).json({ message: 'Product not found' });

      let cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

      const existing = cart.items.find((i) => i.productId.toString() === productId.toString());
      if (existing) {
        existing.quantity = (existing.quantity || 0) + qty;
        existing.price = product.price;
      } else {
        cart.items.push({ productId, quantity: qty, price: product.price });
      }

      await cart.save();
      return res.status(200).json({ message: 'Item added to cart', cart });
    } catch (err) {
      console.error('Add item error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  update: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId, quantity } = req.body || {};
      const { items } = req.body || {};

      let cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) return res.status(404).json({ message: 'Cart not found' });

      if (Array.isArray(items)) {
        if (!items.length) {
          cart.items = [];
        } else {
          const normalized = items.map((it) => ({
            productId: it.productId,
            quantity: parseQuantity(it.quantity, 1),
          }));

          if (normalized.some((it) => !it.productId || !it.quantity || it.quantity < 1)) {
            return res.status(400).json({ message: 'Each item must contain productId and a positive integer quantity' });
          }
          if (normalized.some((it) => !mongoose.Types.ObjectId.isValid(it.productId))) {
            return res.status(400).json({ message: 'One or more productIds are invalid' });
          }

          const productIds = [...new Set(normalized.map((it) => it.productId.toString()))];
          const products = await Product.find({ _id: { $in: productIds } }).select('_id price');
          if (products.length !== productIds.length) {
            return res.status(400).json({ message: 'One or more products are invalid' });
          }

          const priceById = new Map(products.map((p) => [p._id.toString(), p.price]));
          cart.items = normalized.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            price: priceById.get(it.productId.toString()),
          }));
        }
      } else if (productId !== undefined) {
        if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid productId' });
        const existing = cart.items.find((i) => i.productId.toString() === productId.toString());
        if (!existing) return res.status(404).json({ message: 'Item not found in cart' });
        const qty = parseQuantity(quantity, NaN);
        if (!Number.isFinite(qty)) return res.status(400).json({ message: 'quantity must be a number' });
        if (qty <= 0) {
          // remove
          cart.items = cart.items.filter((i) => i.productId.toString() !== productId.toString());
        } else {
          const product = await Product.findById(productId).select('price');
          if (!product) return res.status(404).json({ message: 'Product not found' });
          existing.quantity = qty;
          existing.price = product.price;
        }
      } else {
        return res.status(400).json({ message: 'productId/quantity or items array required' });
      }

      await cart.save();
      return res.status(200).json({ message: 'Cart updated', cart });
    } catch (err) {
      console.error('Update cart error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  remove: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId } = req.params;
      if (!productId) return res.status(400).json({ message: 'productId is required' });

      const cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) return res.status(404).json({ message: 'Cart not found' });

      cart.items = cart.items.filter((i) => i.productId.toString() !== productId.toString());
      await cart.save();
      return res.status(200).json({ message: 'Item removed', cart });
    } catch (err) {
      console.error('Remove item error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  clear: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) return res.status(404).json({ message: 'Cart not found' });
      cart.items = [];
      await cart.save();
      return res.status(200).json({ message: 'Cart cleared' });
    } catch (err) {
      console.error('Clear cart error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
