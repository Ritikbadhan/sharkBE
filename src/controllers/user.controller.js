const User = require('../models/User.model');
const bcrypt = require('bcryptjs');

function safeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
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

      if (name) user.name = name;
      if (email) user.email = email.toLowerCase();
      if (password) {
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(password, salt);
      }

      await user.save();
      return res.status(200).json({ message: 'Profile updated', user: safeUser(user) });
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
};
