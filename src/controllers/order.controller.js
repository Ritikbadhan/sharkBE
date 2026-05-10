const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const Coupon = require('../models/Coupon.model');
const mongoose = require('mongoose');
const { isRazorpayConfigured } = require('../config/razorpay');

const GST_RATE = 0.12;
const STANDARD_SHIPPING = 120;
const FREE_SHIPPING_THRESHOLD = 1999;

function parseQuantity(value) {
  const qty = Number(value);
  return Number.isFinite(qty) ? Math.floor(qty) : NaN;
}

function normalizeCouponCode(value) {
  return String(value || '').trim().toUpperCase();
}

function calculateCouponDiscount(coupon, subtotal) {
  if (!coupon || !subtotal || subtotal <= 0) return 0;
  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = Math.floor((subtotal * Number(coupon.discountValue || 0)) / 100);
  } else {
    discount = Math.floor(Number(coupon.discountValue || 0));
  }
  if (coupon.maxDiscountAmount !== undefined && coupon.maxDiscountAmount !== null) {
    discount = Math.min(discount, Number(coupon.maxDiscountAmount));
  }
  return Math.max(0, Math.min(discount, subtotal));
}

function buildTrackingEvents(order) {
  const events = [
    { status: 'Order Placed', timestamp: order.createdAt }
  ];
  const status = String(order.orderStatus || '').toLowerCase();
  if (status.includes('ship')) events.push({ status: 'Shipped', timestamp: order.updatedAt });
  if (status.includes('deliver')) events.push({ status: 'Delivered', timestamp: order.updatedAt });
  if (status.includes('cancel')) events.push({ status: 'Cancelled', timestamp: order.cancelledAt || order.updatedAt });
  if (status.includes('return')) events.push({ status: 'Returned', timestamp: order.updatedAt });
  return events;
}

function getShipping(subtotal) {
  return subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : STANDARD_SHIPPING;
}

function findMatchingVariant(product, item) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) return null;

  const requestedSize = String(item.size || '').trim().toLowerCase();
  const requestedColor = String(item.color || '').trim().toLowerCase();

  return product.variants.find((variant) => {
    const variantSize = String(variant.size || '').trim().toLowerCase();
    const variantColor = String(variant.color || '').trim().toLowerCase();

    if (requestedSize && variantSize !== requestedSize) return false;
    if (requestedColor && variantColor !== requestedColor) return false;
    if (!requestedSize && !requestedColor) return false;
    return true;
  }) || null;
}

function getInventorySnapshot(product, item) {
  const variant = findMatchingVariant(product, item);
  if (variant) {
    return {
      variant,
      availableStock: Number(variant.stock || 0),
      stockLabel: 'variant'
    };
  }

  return {
    variant: null,
    availableStock: Number(product.stock || 0),
    stockLabel: 'product'
  };
}

function decrementInventory(product, item) {
  const qty = Number(item.quantity || 0);
  const { variant } = getInventorySnapshot(product, item);

  if (variant) {
    variant.stock = Math.max(0, Number(variant.stock || 0) - qty);
    product.stock = product.variants.reduce((sum, current) => sum + Number(current.stock || 0), 0);
    return;
  }

  product.stock = Math.max(0, Number(product.stock || 0) - qty);
}

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { items, shippingAddress, paymentMethod, paymentId, invoiceUrl, trackingUrl, couponCode } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Order items required' });
      if (!paymentMethod) return res.status(400).json({ message: 'paymentMethod required' });
      const normalizedPaymentMethod = String(paymentMethod).trim().toUpperCase();
      if (normalizedPaymentMethod === 'RAZORPAY' && !isRazorpayConfigured()) {
        return res.status(503).json({ message: 'Razorpay test/live keys are not configured yet. Use COD for now or add Razorpay test keys.' });
      }

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
      const products = await Product.find({ _id: { $in: productIds } }).select('_id name price images stock variants');
      if (products.length !== productIds.length) {
        return res.status(400).json({ message: 'One or more products are invalid' });
      }

      const productById = new Map(products.map((p) => [p._id.toString(), p]));
      let subtotal = 0;

      for (const item of normalized) {
        const product = productById.get(item.productId.toString());
        const { availableStock, stockLabel } = getInventorySnapshot(product, item);
        if (availableStock < item.quantity) {
          return res.status(400).json({
            message: 'One or more items are out of stock',
            item: {
              productId: product._id,
              name: product.name,
              requestedQuantity: item.quantity,
              availableStock,
              size: item.size || null,
              color: item.color || null,
              stockType: stockLabel
            }
          });
        }
      }

      const trustedItems = normalized.map((it) => {
        const product = productById.get(it.productId.toString());
        const linePrice = product.price;
        subtotal += linePrice * it.quantity;
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

      let appliedCoupon = null;
      let discountAmount = 0;
      const normalizedCouponCode = normalizeCouponCode(couponCode);
      if (normalizedCouponCode) {
        const now = new Date();
        const coupon = await Coupon.findOne({
          code: normalizedCouponCode,
          isActive: true,
          $or: [{ startsAt: null }, { startsAt: { $lte: now } }],
          $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] }]
        });
        if (!coupon) return res.status(400).json({ message: 'Invalid or expired coupon code' });
        if (subtotal < Number(coupon.minOrderAmount || 0)) {
          return res.status(400).json({ message: `Minimum order amount is ${coupon.minOrderAmount} for this coupon` });
        }
        discountAmount = calculateCouponDiscount(coupon, subtotal);
        appliedCoupon = coupon;
      }

      const discountedSubtotal = Math.max(0, subtotal - discountAmount);
      const shippingAmount = getShipping(discountedSubtotal);
      const taxAmount = Math.max(0, Math.round(discountedSubtotal * GST_RATE));
      const totalAmount = discountedSubtotal + shippingAmount + taxAmount;

      const order = new Order({
        userId: req.user._id,
        items: trustedItems,
        shippingAddress,
        paymentMethod: normalizedPaymentMethod,
        subtotalAmount: subtotal,
        shippingAmount,
        taxAmount,
        totalAmount,
        paymentId,
        invoiceUrl,
        trackingUrl,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        discountAmount,
        discountType: appliedCoupon ? appliedCoupon.discountType : undefined,
        discountValue: appliedCoupon ? appliedCoupon.discountValue : undefined,
        returnEligible: true
      });

      for (const item of normalized) {
        const product = productById.get(item.productId.toString());
        decrementInventory(product, item);
      }

      await Promise.all(products.map((product) => product.save()));
      await order.save();
      return res.status(201).json({ message: 'Order placed', order });
    } catch (err) {
      console.error('Create order error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  list: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
      return res.status(200).json({ orders });
    } catch (err) {
      console.error('List orders error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  userOrders: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
      return res.status(200).json({ orders });
    } catch (err) {
      console.error('User orders error:', err);
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

  track: async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

      const order = await Order.findById(id).populate('userId', '_id');
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId._id.toString() !== (req.user && req.user._id.toString()) && !(req.user && req.user.role === 'admin')) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      return res.status(200).json({
        orderId: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        trackingId: order.trackingId || null,
        trackingUrl: order.trackingUrl || null,
        events: buildTrackingEvents(order)
      });
    } catch (err) {
      console.error('Track order error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  validateCoupon: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const code = normalizeCouponCode(req.body && req.body.code);
      const subtotal = Number((req.body && req.body.subtotal) || 0);
      if (!code) return res.status(400).json({ message: 'code is required' });
      if (!Number.isFinite(subtotal) || subtotal < 0) return res.status(400).json({ message: 'subtotal must be a valid number' });

      const now = new Date();
      const coupon = await Coupon.findOne({
        code,
        isActive: true,
        $or: [{ startsAt: null }, { startsAt: { $lte: now } }],
        $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] }]
      });
      if (!coupon) return res.status(404).json({ valid: false, message: 'Coupon not found or expired' });
      if (subtotal < Number(coupon.minOrderAmount || 0)) {
        return res.status(400).json({
          valid: false,
          message: `Minimum order amount is ${coupon.minOrderAmount} for this coupon`
        });
      }

      const discountAmount = calculateCouponDiscount(coupon, subtotal);
      return res.status(200).json({
        valid: true,
        coupon: {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderAmount: coupon.minOrderAmount,
          maxDiscountAmount: coupon.maxDiscountAmount || null
        },
        discountAmount,
        finalAmount: Math.max(0, subtotal - discountAmount)
      });
    } catch (err) {
      console.error('Validate coupon error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  updateStatus: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
      const {
        action,
        orderStatus,
        paymentStatus,
        invoiceUrl,
        trackingUrl,
        trackingId,
        returnEligible,
        refundAmount,
        reason,
        metadata
      } = req.body || {};
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      if (invoiceUrl !== undefined) order.invoiceUrl = invoiceUrl;
      if (trackingUrl !== undefined) order.trackingUrl = trackingUrl;
      if (trackingId !== undefined) order.trackingId = trackingId;
      if (returnEligible !== undefined) order.returnEligible = Boolean(returnEligible);
      if (metadata !== undefined && metadata !== null && typeof metadata === 'object') {
        order.actionPayload = metadata;
      }

      if (action) {
        switch (action) {
          case 'update_status':
            if (!orderStatus && !paymentStatus) {
              return res.status(400).json({ message: 'orderStatus or paymentStatus is required for update_status' });
            }
            if (orderStatus) order.orderStatus = orderStatus;
            if (paymentStatus) order.paymentStatus = paymentStatus;
            break;
          case 'mark_shipped':
            if (!trackingId && !order.trackingId) {
              return res.status(400).json({ message: 'trackingId is required for mark_shipped' });
            }
            order.orderStatus = 'Shipped';
            break;
          case 'refund':
            order.paymentStatus = 'refunded';
            order.orderStatus = order.orderStatus === 'Cancelled' ? order.orderStatus : 'Returned';
            order.refundAmount = refundAmount !== undefined ? Number(refundAmount) : order.totalAmount;
            order.refundedAt = new Date();
            if (reason) order.refundReason = reason;
            break;
          case 'cancel':
            order.orderStatus = 'Cancelled';
            if (reason) order.cancelReason = reason;
            order.cancelledAt = new Date();
            break;
          default:
            return res.status(400).json({ message: 'Unsupported action' });
        }
      } else {
        if (orderStatus) order.orderStatus = orderStatus;
        if (paymentStatus) order.paymentStatus = paymentStatus;
      }

      await order.save();
      return res.status(200).json({ message: 'Order updated', order });
    } catch (err) {
      console.error('Update order status error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
