const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');
const mongoose = require('mongoose');

function parseQuantity(value, fallback = 1) {
  const qty = value === undefined ? fallback : Number(value);
  return Number.isFinite(qty) ? Math.floor(qty) : NaN;
}

function normalizeVariant(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

function isSameVariant(item, size, color) {
  const itemSize = normalizeVariant(item.size);
  const itemColor = normalizeVariant(item.color);
  return itemSize === normalizeVariant(size) && itemColor === normalizeVariant(color);
}

function mapCartItem(item, product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return {
    productId: product._id.toString(),
    name: product.name,
    price: product.price,
    originalPrice: product.originalPrice ?? product.mrp ?? product.price,
    image: images[0] || null,
    quantity: item.quantity,
    size: item.size || null,
    color: item.color || null,
    category: product.category || '',
    collection: product.collection || '',
    description: product.description || '',
    stock: Number.isFinite(product.stock) ? product.stock : 0
  };
}

async function buildCartResponse(cart) {
  const productIds = [...new Set((cart.items || []).map((i) => i.productId.toString()))];
  if (!productIds.length) return { items: [], totalItems: 0, totalAmount: 0 };

  const products = await Product.find({ _id: { $in: productIds } }).select(
    '_id name price originalPrice mrp images category collection description stock'
  );
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  const items = [];
  let totalAmount = 0;
  let totalItems = 0;
  for (const item of cart.items) {
    const product = productById.get(item.productId.toString());
    if (!product) continue;
    const mapped = mapCartItem(item, product);
    items.push(mapped);
    totalItems += item.quantity;
    totalAmount += Number(product.price || 0) * Number(item.quantity || 0);
  }

  return {
    items,
    totalItems,
    totalAmount
  };
}

module.exports = {
  getCart: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      let cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) cart = await Cart.create({ userId: req.user._id, items: [] });

      const cartResponse = await buildCartResponse(cart);
      return res.status(200).json({ cart: cartResponse });
    } catch (err) {
      console.error('Get cart error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  addItem: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId, quantity = 1, size, color } = req.body || {};
      if (!productId) return res.status(400).json({ message: 'productId is required' });
      if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid productId' });
      const qty = parseQuantity(quantity, 1);
      if (!qty || qty < 1) return res.status(400).json({ message: 'quantity must be a positive integer' });

      const product = await Product.findById(productId).select('price addedToCartCount');
      if (!product) return res.status(404).json({ message: 'Product not found' });

      let cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

      const normalizedSize = normalizeVariant(size);
      const normalizedColor = normalizeVariant(color);
      const existing = cart.items.find(
        (i) => i.productId.toString() === productId.toString() && isSameVariant(i, normalizedSize, normalizedColor)
      );

      if (existing) {
        existing.quantity = (existing.quantity || 0) + qty;
        existing.price = product.price;
      } else {
        cart.items.push({
          productId,
          quantity: qty,
          price: product.price,
          size: normalizedSize,
          color: normalizedColor
        });
      }

      product.addedToCartCount = Number(product.addedToCartCount || 0) + qty;
      await Promise.all([cart.save(), product.save()]);

      const cartResponse = await buildCartResponse(cart);
      return res.status(200).json({ message: 'Item added to cart', cart: cartResponse });
    } catch (err) {
      console.error('Add item error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  update: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId, quantity, size, color } = req.body || {};

      if (!productId) return res.status(400).json({ message: 'productId is required' });
      if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid productId' });
      const qty = parseQuantity(quantity, NaN);
      if (!Number.isFinite(qty)) return res.status(400).json({ message: 'quantity must be a number' });

      const cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) return res.status(404).json({ message: 'Cart not found' });

      const normalizedSize = normalizeVariant(size);
      const normalizedColor = normalizeVariant(color);
      const existingIndex = cart.items.findIndex(
        (i) => i.productId.toString() === productId.toString() && isSameVariant(i, normalizedSize, normalizedColor)
      );
      if (existingIndex === -1) return res.status(404).json({ message: 'Item not found in cart' });

      if (qty <= 0) {
        cart.items.splice(existingIndex, 1);
      } else {
        const product = await Product.findById(productId).select('price');
        if (!product) return res.status(404).json({ message: 'Product not found' });
        cart.items[existingIndex].quantity = qty;
        cart.items[existingIndex].price = product.price;
      }

      await cart.save();
      const cartResponse = await buildCartResponse(cart);
      return res.status(200).json({ message: 'Cart updated', cart: cartResponse });
    } catch (err) {
      console.error('Update cart error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  remove: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId } = req.params;
      const size = normalizeVariant(req.query.size || (req.body && req.body.size));
      const color = normalizeVariant(req.query.color || (req.body && req.body.color));
      if (!productId) return res.status(400).json({ message: 'productId is required' });

      const cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) return res.status(404).json({ message: 'Cart not found' });

      cart.items = cart.items.filter((i) => {
        if (i.productId.toString() !== productId.toString()) return true;
        if (size === undefined && color === undefined) return false;
        return !isSameVariant(i, size, color);
      });
      await cart.save();

      const cartResponse = await buildCartResponse(cart);
      return res.status(200).json({ message: 'Item removed', cart: cartResponse });
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
      return res.status(200).json({ message: 'Cart cleared', cart: { items: [], totalItems: 0, totalAmount: 0 } });
    } catch (err) {
      console.error('Clear cart error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
