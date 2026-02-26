const Cart = require('../models/Cart.model');

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
      const { productId, quantity = 1, price } = req.body || {};
      if (!productId) return res.status(400).json({ message: 'productId is required' });

      let cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

      const existing = cart.items.find((i) => i.productId.toString() === productId.toString());
      if (existing) {
        existing.quantity = (existing.quantity || 0) + Number(quantity);
        if (price !== undefined) existing.price = price;
      } else {
        cart.items.push({ productId, quantity: Number(quantity), price });
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
        // replace items array (validate basic shape)
        cart.items = items.map((it) => ({ productId: it.productId, quantity: Number(it.quantity || 1), price: it.price }));
      } else if (productId !== undefined) {
        const existing = cart.items.find((i) => i.productId.toString() === productId.toString());
        if (!existing) return res.status(404).json({ message: 'Item not found in cart' });
        if (quantity <= 0) {
          // remove
          cart.items = cart.items.filter((i) => i.productId.toString() !== productId.toString());
        } else {
          existing.quantity = Number(quantity);
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
