const User = require('../models/User.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_strong_secret';

function safeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  return obj;
}

module.exports = {
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'name, email and password are required' });
      }

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = new User({ name, email: email.toLowerCase(), passwordHash });
      await user.save();

      return res.status(201).json({ message: 'User registered', user: safeUser(user) });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ message: 'Server error during registration' });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ message: 'email and password are required' });
      }

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const payload = { id: user._id, role: user.role };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

      return res.status(200).json({ message: 'Login successful', token, user: safeUser(user) });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ message: 'Server error during login' });
    }
  },
  logout: async (req, res) => {
    try {
      // With stateless JWTs, logout is handled client-side by discarding the token.
      // Optionally implement token blacklisting here.
      return res.status(200).json({ message: 'Logout successful' });
    } catch (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Server error during logout' });
    }
  },

  me: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      return res.status(200).json({ user: safeUser(req.user) });
    } catch (err) {
      console.error('Me error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ message: 'email is required' });

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Do not reveal that the email does not exist
        return res.status(200).json({ message: 'If that email exists, a reset token was generated' });
      }

      const token = crypto.randomBytes(20).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();

      // In production, send `token` via email to the user. For now, return it in response for testing.
      return res.status(200).json({ message: 'Reset token generated', resetToken: token });
    } catch (err) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { token, password } = req.body || {};
      if (!token || !password) return res.status(400).json({ message: 'token and password are required' });

      const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
      if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return res.status(200).json({ message: 'Password has been reset' });
    } catch (err) {
      console.error('Reset password error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },
};
