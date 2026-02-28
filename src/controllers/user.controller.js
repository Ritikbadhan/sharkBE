const User = require('../models/User.model');
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');
const Address = require('../models/Address.model');
const ReturnRequest = require('../models/Return.model');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { sendEmail } = require('../services/email.service');
const { toProductResponse, toAccountOrder, toAddressResponse } = require('../utils/serializers');

function safeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.emailVerificationCode;
  delete obj.emailVerificationExpires;
  return obj;
}

module.exports = {
  getProfile: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      return res.status(200).json({ user: safeUser(req.user) });
    } catch (err) {
      console.error('Get profile error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  updateProfile: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

      const { name, email, password } = req.body || {};
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      let emailChanged = false;

      if (name) user.name = name;
      if (email) {
        const normalizedEmail = email.toLowerCase();
        if (normalizedEmail !== user.email) {
          const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
          if (existing) return res.status(409).json({ message: 'Email already in use' });
          user.email = normalizedEmail;
          user.emailVerified = false;
          user.emailVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          user.emailVerificationExpires = Date.now() + 10 * 60 * 1000;
          emailChanged = true;
        }
      }
      if (password) {
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(password, salt);
      }

      await user.save();

      if (emailChanged && user.emailVerificationCode) {
        try {
          await sendEmail(
            user.email,
            'Verify your updated email',
            `Your email verification code is ${user.emailVerificationCode}`
          );
        } catch (emailErr) {
          console.warn('Failed to send updated email verification code:', emailErr.message || emailErr);
        }
      }

      return res.status(200).json({
        message: emailChanged ? 'Profile updated. Please verify your new email address.' : 'Profile updated',
        user: safeUser(user)
      });
    } catch (err) {
      console.error('Update profile error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  deleteProfile: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      await User.findByIdAndDelete(req.user._id);
      return res.status(200).json({ message: 'User deleted' });
    } catch (err) {
      console.error('Delete profile error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  getWishlist: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const user = await User.findById(req.user._id).select('wishlist');
      const productIds = (user && user.wishlist) || [];
      const products = await Product.find({ _id: { $in: productIds } });
      const productById = new Map(products.map((p) => [p._id.toString(), p]));
      const wishlist = productIds
        .map((id) => productById.get(id.toString()))
        .filter(Boolean)
        .map((p) => toProductResponse(p, { cardOnly: true }));

      return res.status(200).json({ wishlist });
    } catch (err) {
      console.error('Get wishlist error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  addWishlist: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId } = req.body || {};
      if (!productId) return res.status(400).json({ message: 'productId is required' });
      if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid productId' });

      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      await User.findByIdAndUpdate(req.user._id, { $addToSet: { wishlist: productId } });
      return res.status(200).json({ message: 'Added to wishlist' });
    } catch (err) {
      console.error('Add wishlist error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  removeWishlist: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid productId' });

      await User.findByIdAndUpdate(req.user._id, { $pull: { wishlist: productId } });
      return res.status(200).json({ message: 'Removed from wishlist' });
    } catch (err) {
      console.error('Remove wishlist error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  getAccount: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

      const [user, orders, addresses, returns] = await Promise.all([
        User.findById(req.user._id).select('-passwordHash -resetPasswordToken -resetPasswordExpires -emailVerificationCode -emailVerificationExpires'),
        Order.find({ userId: req.user._id }).sort({ createdAt: -1 }),
        Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 }),
        ReturnRequest.find({ userId: req.user._id }).sort({ createdAt: -1 })
      ]);

      if (!user) return res.status(404).json({ message: 'User not found' });

      return res.status(200).json({
        profile: safeUser(user),
        orders: orders.map((o) => toAccountOrder(o)),
        addresses: addresses.map((a) => toAddressResponse(a)),
        paymentMethods: user.paymentMethods || [],
        rewards: user.rewards || { points: 0, tier: 'Bronze' },
        returns: returns.map((r) => ({
          id: r._id,
          orderId: r.orderId,
          productId: r.productId,
          reason: r.reason,
          comment: r.comment || null,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        }))
      });
    } catch (err) {
      console.error('Get account error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
