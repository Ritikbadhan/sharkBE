const Review = require('../models/Review.model');

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId, rating, title, body } = req.body || {};
      if (!productId || rating === undefined) return res.status(400).json({ message: 'productId and rating are required' });

      const review = new Review({ user: req.user._id, productId, rating, title, body });
      await review.save();
      return res.status(201).json({ message: 'Review created', review });
    } catch (err) {
      console.error('Create review error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  listByProduct: async (req, res) => {
    try {
      const { productId } = req.params;
      const reviews = await Review.find({ productId }).populate('user', 'name email').sort({ createdAt: -1 });
      return res.status(200).json({ reviews });
    } catch (err) {
      console.error('List reviews error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  delete: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { id } = req.params;
      const review = await Review.findById(id);
      if (!review) return res.status(404).json({ message: 'Review not found' });
      // allow owner or admin
      if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      await Review.findByIdAndDelete(id);
      return res.status(200).json({ message: 'Review deleted' });
    } catch (err) {
      console.error('Delete review error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
