const Address = require('../models/Address.model');

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { line1, line2, city, state, postalCode, country, phone } = req.body || {};
      if (!line1 || !city || !country) return res.status(400).json({ message: 'line1, city and country are required' });

      const address = new Address({
        user: req.user._id,
        line1,
        line2,
        city,
        state,
        postalCode,
        country,
        phone
      });
      await address.save();
      return res.status(201).json({ message: 'Address created', address });
    } catch (err) {
      console.error('Create address error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  list: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const addresses = await Address.find({ user: req.user._id }).sort({ createdAt: -1 });
      return res.status(200).json({ addresses });
    } catch (err) {
      console.error('List addresses error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  update: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { id } = req.params;
      const { line1, line2, city, state, postalCode, country, phone } = req.body || {};

      const address = await Address.findById(id);
      if (!address) return res.status(404).json({ message: 'Address not found' });
      if (address.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });

      if (line1 !== undefined) address.line1 = line1;
      if (line2 !== undefined) address.line2 = line2;
      if (city !== undefined) address.city = city;
      if (state !== undefined) address.state = state;
      if (postalCode !== undefined) address.postalCode = postalCode;
      if (country !== undefined) address.country = country;
      if (phone !== undefined) address.phone = phone;

      await address.save();
      return res.status(200).json({ message: 'Address updated', address });
    } catch (err) {
      console.error('Update address error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  delete: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { id } = req.params;
      const address = await Address.findById(id);
      if (!address) return res.status(404).json({ message: 'Address not found' });
      if (address.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });

      await Address.findByIdAndDelete(id);
      return res.status(200).json({ message: 'Address deleted' });
    } catch (err) {
      console.error('Delete address error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
