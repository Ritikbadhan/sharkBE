const User = require('../models/User.model');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../services/email.service');

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
            `Your email verification code is ${user.emailVerificationCode}`,
          );
        } catch (emailErr) {
          console.warn('Failed to send updated email verification code:', emailErr.message || emailErr);
        }
      }

      return res.status(200).json({
        message: emailChanged ? 'Profile updated. Please verify your new email address.' : 'Profile updated',
        user: safeUser(user),
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
};
