const Address = require('../models/Address.model');
const { toAddressResponse } = require('../utils/serializers');

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const {
        name,
        phone,
        line1,
        line2,
        city,
        state,
        pincode,
        landmark,
        instructions,
        isDefault
      } = req.body || {};

      if (!line1 || !city) {
        return res.status(400).json({ message: 'line1 and city are required' });
      }

      if (isDefault) {
        await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
      }

      const address = new Address({
        user: req.user._id,
        name,
        phone,
        line1,
        line2,
        city,
        state,
        pincode,
        postalCode: pincode,
        landmark,
        instructions,
        isDefault: Boolean(isDefault)
      });

      await address.save();
      return res.status(201).json({ message: 'Address created', address: toAddressResponse(address) });
    } catch (err) {
      console.error('Create address error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  list: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
      return res.status(200).json({ addresses: addresses.map((a) => toAddressResponse(a)) });
    } catch (err) {
      console.error('List addresses error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  update: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { id } = req.params;
      const address = await Address.findById(id);
      if (!address) return res.status(404).json({ message: 'Address not found' });
      if (address.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });

      const fields = ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode', 'landmark', 'instructions', 'isDefault'];
      fields.forEach((field) => {
        if (req.body[field] !== undefined) address[field] = req.body[field];
      });

      if (req.body.pincode !== undefined) address.postalCode = req.body.pincode;
      if (req.body.isDefault) {
        await Address.updateMany({ user: req.user._id, _id: { $ne: address._id } }, { $set: { isDefault: false } });
      }

      await address.save();
      return res.status(200).json({ message: 'Address updated', address: toAddressResponse(address) });
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
