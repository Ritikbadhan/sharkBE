const Review = require('../models/Review.model');
const Product = require('../models/Product.model');
const mongoose = require('mongoose');

async function syncProductReviewStats(productId) {
  const stats = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$productId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);

  const avgRating = stats[0] ? Number(stats[0].avgRating.toFixed(1)) : 0;
  const count = stats[0] ? stats[0].count : 0;
  await Product.findByIdAndUpdate(productId, { rating: avgRating, reviewCount: count });
}

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const { productId, rating, title, comment, body, images } = req.body || {};
      if (!productId || rating === undefined || !(comment || body)) {
        return res.status(400).json({ message: 'productId, rating and comment are required' });
      }
      if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid productId' });

      const review = new Review({
        user: req.user._id,
        productId,
        rating,
        title,
        comment: comment || body,
        body: body || comment,
        images: Array.isArray(images) ? images : images ? [images] : []
      });
      await review.save();
      await syncProductReviewStats(productId);

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
      if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      await Review.findByIdAndDelete(id);
      await syncProductReviewStats(review.productId);
      return res.status(200).json({ message: 'Review deleted' });
    } catch (err) {
      console.error('Delete review error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
