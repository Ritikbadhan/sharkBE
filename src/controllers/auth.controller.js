const User = require('../models/User.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../services/email.service');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

function safeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.smsVerificationCode;
  delete obj.smsVerificationExpires;
  delete obj.emailVerificationCode;
  delete obj.emailVerificationExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
}

module.exports = {
  register: async (req, res) => {
    try {
      const { name, email, password, phone } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'name, email and password are required' });
      }

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // generate 6-digit Email verification code
      const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
      const emailExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

      const user = new User({
        name,
        email: email.toLowerCase(),
        passwordHash,
        phone: phone || undefined,
        emailVerificationCode: emailCode,
        emailVerificationExpires: emailExpires,
        emailVerified: false,
      });
      await user.save();

      // send email OTP
      try {
        await sendEmail(
          user.email,
          'Your verification code',
          `Your email verification code is ${emailCode}`,
        );
      } catch (emailErr) {
        console.warn('Failed to send verification email:', emailErr.message || emailErr);
      }

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
      if (!user.emailVerified) {
        return res.status(401).json({ message: 'Please verify your email before logging in' });
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
        return res.status(200).json({ message: 'If that email exists, password reset instructions were sent' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.resetPasswordToken = tokenHash;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetLink = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

      try {
        await sendEmail(
          user.email,
          'Password reset instructions',
          `Reset your password using this link: ${resetLink}`,
        );
      } catch (emailErr) {
        console.warn('Failed to send reset password email:', emailErr.message || emailErr);
      }

      return res.status(200).json({ message: 'If that email exists, password reset instructions were sent' });
    } catch (err) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { token, password } = req.body || {};
      if (!token || !password) return res.status(400).json({ message: 'token and password are required' });

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({ resetPasswordToken: tokenHash, resetPasswordExpires: { $gt: Date.now() } });
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
  verifyEmail: async (req, res) => {
    try {
      const { email, code } = req.body || {};
      if (!email || !code) return res.status(400).json({ message: 'email and code are required' });

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (!user.emailVerificationCode || !user.emailVerificationExpires || user.emailVerificationExpires < Date.now()) {
        return res.status(400).json({ message: 'Invalid or expired verification code' });
      }

      if (user.emailVerificationCode !== code) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }

      user.emailVerified = true;
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      return res.status(200).json({ message: 'Email has been verified' });
    } catch (err) {
      console.error('Verify email error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },
};
