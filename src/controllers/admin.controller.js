const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const Review = require('../models/Review.model');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

function ensureAdmin(req, res) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden' });
    return false;
  }
  return true;
}

function normalizeRole(role) {
  const raw = String(role || '').trim().toLowerCase();
  if (raw === 'admin') return 'admin';
  if (raw === 'user') return 'user';
  return null;
}

module.exports = {
  listUsers: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const users = await User.find().select('-passwordHash -resetPasswordToken -resetPasswordExpires').sort({ createdAt: -1 });
      return res.status(200).json({ users });
    } catch (err) {
      console.error('Admin list users error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  listOrders: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const orders = await Order.find().populate('userId', 'name email').sort({ createdAt: -1 });
      return res.status(200).json({ orders });
    } catch (err) {
      console.error('Admin list orders error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  getOrderById: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const { id } = req.params;
      const order = await Order.findById(id).populate('userId', 'name email');
      if (!order) return res.status(404).json({ message: 'Order not found' });
      return res.status(200).json({ order });
    } catch (err) {
      console.error('Admin get order error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  updateOrder: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const { id } = req.params;
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
          case 'update_status': {
            if (!orderStatus && !paymentStatus) {
              return res.status(400).json({ message: 'orderStatus or paymentStatus is required for update_status' });
            }
            if (orderStatus) order.orderStatus = orderStatus;
            if (paymentStatus) order.paymentStatus = paymentStatus;
            break;
          }
          case 'mark_shipped': {
            if (!trackingId && !order.trackingId) {
              return res.status(400).json({ message: 'trackingId is required for mark_shipped' });
            }
            order.orderStatus = 'Shipped';
            break;
          }
          case 'refund': {
            order.paymentStatus = 'refunded';
            order.orderStatus = order.orderStatus === 'Cancelled' ? order.orderStatus : 'Returned';
            order.refundAmount = refundAmount !== undefined ? Number(refundAmount) : order.totalAmount;
            order.refundedAt = new Date();
            if (reason) order.refundReason = reason;
            break;
          }
          case 'cancel': {
            order.orderStatus = 'Cancelled';
            if (reason) order.cancelReason = reason;
            order.cancelledAt = new Date();
            break;
          }
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
      console.error('Admin update order error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  ordersAction: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const { action, filters } = req.body || {};
      if (action !== 'export') return res.status(400).json({ message: 'Unsupported action' });

      const query = {};
      if (filters && typeof filters === 'object') {
        if (filters.orderStatus) query.orderStatus = filters.orderStatus;
        if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
        if (filters.from || filters.to) {
          query.createdAt = {};
          if (filters.from) query.createdAt.$gte = new Date(filters.from);
          if (filters.to) query.createdAt.$lte = new Date(filters.to);
        }
      }

      const orders = await Order.find(query).populate('userId', 'name email').sort({ createdAt: -1 }).lean();
      return res.status(200).json({
        action: 'export',
        exportedAt: new Date().toISOString(),
        count: orders.length,
        orders
      });
    } catch (err) {
      console.error('Admin orders action error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  updateUser: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const { id } = req.params;
      const { action, isBlocked, role, newPassword } = req.body || {};
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (!action) return res.status(400).json({ message: 'action is required' });

      if (action === 'block') {
        user.isBlocked = isBlocked === undefined ? true : Boolean(isBlocked);
      } else if (action === 'set_role') {
        const normalized = normalizeRole(role);
        if (!normalized) return res.status(400).json({ message: 'role must be user or admin' });
        user.role = normalized;
      } else if (action === 'reset_password') {
        if (!newPassword || String(newPassword).length < 6) {
          return res.status(400).json({ message: 'newPassword with minimum 6 characters is required' });
        }
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(String(newPassword), salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
      } else {
        return res.status(400).json({ message: 'Unsupported action' });
      }

      await user.save();
      const safe = user.toObject();
      delete safe.passwordHash;
      delete safe.resetPasswordToken;
      delete safe.resetPasswordExpires;
      return res.status(200).json({ message: 'User updated', user: safe });
    } catch (err) {
      console.error('Admin update user error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  listReviews: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const reviews = await Review.find().populate('user', 'name email').sort({ createdAt: -1 });
      return res.status(200).json({ reviews });
    } catch (err) {
      console.error('Admin list reviews error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  updateReview: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const { id } = req.params;
      const { action } = req.body || {};
      if (!action) return res.status(400).json({ message: 'action is required' });

      const review = await Review.findById(id);
      if (!review) return res.status(404).json({ message: 'Review not found' });

      if (action === 'approve') {
        review.isApproved = true;
        review.isHidden = false;
      } else if (action === 'hide_abusive') {
        review.isHidden = true;
      } else if (action === 'feature') {
        review.isFeatured = true;
      } else {
        return res.status(400).json({ message: 'Unsupported action' });
      }

      await review.save();
      return res.status(200).json({ message: 'Review updated', review });
    } catch (err) {
      console.error('Admin update review error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  deleteReview: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const { id } = req.params;
      const deleted = await Review.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ message: 'Review not found' });
      return res.status(200).json({ message: 'Review deleted' });
    } catch (err) {
      console.error('Admin delete review error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  listInventory: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const products = await Product.find().select('name stock variants').sort({ createdAt: -1 }).lean();
      const inventory = [];

      for (const product of products) {
        if (Array.isArray(product.variants) && product.variants.length) {
          for (const variant of product.variants) {
            inventory.push({
              productId: product._id,
              productName: product.name,
              variantId: variant._id || null,
              sku: variant.sku || null,
              size: variant.size || null,
              color: variant.color || null,
              stock: Number(variant.stock || 0)
            });
          }
        } else {
          inventory.push({
            productId: product._id,
            productName: product.name,
            variantId: null,
            sku: null,
            size: null,
            color: null,
            stock: Number(product.stock || 0)
          });
        }
      }

      return res.status(200).json({ inventory });
    } catch (err) {
      console.error('Admin list inventory error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  updateInventory: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const { variantId, stock } = req.body || {};
      if (!variantId) return res.status(400).json({ message: 'variantId is required' });

      const nextStock = Number(stock);
      if (!Number.isFinite(nextStock) || nextStock < 0) {
        return res.status(400).json({ message: 'stock must be a non-negative number' });
      }

      if (!mongoose.Types.ObjectId.isValid(variantId)) {
        return res.status(400).json({ message: 'Invalid variantId' });
      }

      const product = await Product.findOne({ 'variants._id': variantId });
      if (!product) return res.status(404).json({ message: 'Variant not found' });

      const variant = product.variants.id(variantId);
      if (!variant) return res.status(404).json({ message: 'Variant not found' });
      variant.stock = Math.floor(nextStock);

      await product.save();
      return res.status(200).json({
        message: 'Inventory updated',
        inventory: {
          productId: product._id,
          productName: product.name,
          variantId: variant._id,
          sku: variant.sku || null,
          size: variant.size || null,
          color: variant.color || null,
          stock: variant.stock
        }
      });
    } catch (err) {
      console.error('Admin update inventory error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  dashboardStats: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;

      const usersCount = await User.countDocuments();
      const ordersCount = await Order.countDocuments();
      const productsCount = await Product.countDocuments();

      // total sales: sum of totalAmount for paid orders
      const salesAgg = await Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
      ]);
      const totalSales = (salesAgg[0] && salesAgg[0].totalSales) || 0;

      return res.status(200).json({ usersCount, ordersCount, productsCount, totalSales });
    } catch (err) {
      console.error('Admin dashboard stats error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  promoteUser: async (req, res) => {
    try {
      if (!ensureAdmin(req, res)) return;
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ message: 'userId is required' });
      if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'Invalid userId' });

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.role = 'admin';
      await user.save();
      return res.status(200).json({ message: 'User promoted to admin', user: { id: user._id, email: user.email, role: user.role } });
    } catch (err) {
      console.error('Promote user error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
