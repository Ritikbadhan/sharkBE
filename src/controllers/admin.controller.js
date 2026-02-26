const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const mongoose = require('mongoose');

module.exports = {
  listUsers: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const users = await User.find().select('-passwordHash -resetPasswordToken -resetPasswordExpires').sort({ createdAt: -1 });
      return res.status(200).json({ users });
    } catch (err) {
      console.error('Admin list users error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  listOrders: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const orders = await Order.find().populate('userId', 'name email').sort({ createdAt: -1 });
      return res.status(200).json({ orders });
    } catch (err) {
      console.error('Admin list orders error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  dashboardStats: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

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
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
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
