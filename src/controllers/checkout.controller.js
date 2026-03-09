const mongoose = require('mongoose');
const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');

const GST_RATE = 0.12;
const STANDARD_SHIPPING = 120;
const FREE_SHIPPING_THRESHOLD = 1999;

function parseQuantity(value, fallback = 1) {
  const qty = value === undefined ? fallback : Number(value);
  return Number.isFinite(qty) ? Math.floor(qty) : NaN;
}

function getShipping(subtotal) {
  return subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : STANDARD_SHIPPING;
}

async function getRequestedItems(req) {
  const bodyItems = req.body && Array.isArray(req.body.items) ? req.body.items : null;
  if (bodyItems && bodyItems.length) return bodyItems;

  const cart = await Cart.findOne({ userId: req.user._id });
  return Array.isArray(cart && cart.items)
    ? cart.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        size: i.size,
        color: i.color
      }))
    : [];
}

module.exports = {
  validate: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

      const requestedItems = await getRequestedItems(req);
      if (!requestedItems.length) {
        return res.status(400).json({ message: 'No items provided for checkout validation' });
      }

      const normalized = requestedItems.map((it) => ({
        productId: it && it.productId,
        quantity: parseQuantity((it && it.quantity) ?? (it && it.qty), 1),
        size: it && it.size,
        color: it && it.color
      }));

      if (normalized.some((it) => !it.productId || !it.quantity || it.quantity < 1)) {
        return res.status(400).json({ message: 'Each item must have productId and positive quantity' });
      }
      if (normalized.some((it) => !mongoose.Types.ObjectId.isValid(it.productId))) {
        return res.status(400).json({ message: 'One or more productIds are invalid' });
      }

      const productIds = [...new Set(normalized.map((it) => it.productId.toString()))];
      const products = await Product.find({ _id: { $in: productIds } }).select('_id name price stock images');
      const productById = new Map(products.map((p) => [p._id.toString(), p]));

      const missing = productIds.filter((id) => !productById.has(id));
      if (missing.length) {
        return res.status(400).json({ message: 'One or more products are invalid', missingProductIds: missing });
      }

      let subtotal = 0;
      const warnings = [];
      const items = normalized.map((it) => {
        const product = productById.get(it.productId.toString());
        const stock = Number.isFinite(product.stock) ? product.stock : null;
        const inStock = stock === null ? true : stock >= it.quantity;

        if (!inStock) {
          warnings.push({
            productId: product._id.toString(),
            message: 'Requested quantity exceeds available stock',
            availableStock: stock
          });
        }

        const lineTotal = Number(product.price || 0) * Number(it.quantity || 0);
        subtotal += lineTotal;

        return {
          productId: product._id.toString(),
          name: product.name,
          quantity: it.quantity,
          size: it.size || null,
          color: it.color || null,
          unitPrice: product.price,
          lineTotal,
          stock: stock ?? undefined,
          inStock
        };
      });

      const shipping = getShipping(subtotal);
      const tax = Math.max(0, Math.round(subtotal * GST_RATE));
      const total = subtotal + shipping + tax;

      return res.status(200).json({
        valid: warnings.length === 0,
        items,
        warnings,
        pricing: { subtotal, shipping, tax, total }
      });
    } catch (err) {
      console.error('Checkout validate error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  shippingOptions: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

      const subtotal = Number((req.query && req.query.subtotal) ?? 0) || 0;
      const standardCost = getShipping(subtotal);
      const options = [
        {
          id: 'standard',
          label: 'Standard Delivery',
          etaDays: '3-5',
          cost: standardCost
        },
        {
          id: 'express',
          label: 'Express Delivery',
          etaDays: '1-2',
          cost: subtotal === 0 ? 0 : 199
        }
      ];

      return res.status(200).json({
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        options
      });
    } catch (err) {
      console.error('Checkout shipping options error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
