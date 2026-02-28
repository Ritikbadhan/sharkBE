const Product = require('../models/Product.model');
const Category = require('../models/Category.model');
const mongoose = require('mongoose');
const { toProductResponse } = require('../utils/serializers');

function asArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const payload = { ...(req.body || {}) };

      if (payload.images && !Array.isArray(payload.images)) payload.images = [payload.images];
      if (payload.sizes && !Array.isArray(payload.sizes)) payload.sizes = [payload.sizes];
      if (payload.colors && !Array.isArray(payload.colors)) payload.colors = [payload.colors];
      if (!payload.name || payload.price === undefined) {
        return res.status(400).json({ message: 'name and price are required' });
      }

      if (payload.categoryId && !mongoose.Types.ObjectId.isValid(payload.categoryId)) {
        const cat = (await Category.findOne({ slug: payload.categoryId })) || (await Category.findOne({ name: payload.categoryId }));
        if (!cat) return res.status(400).json({ message: 'Invalid categoryId' });
        payload.categoryId = cat._id;
        if (!payload.category) payload.category = cat.name;
      }

      const product = new Product(payload);
      await product.save();
      return res.status(201).json({ message: 'Product created', product: toProductResponse(product) });
    } catch (err) {
      console.error('Create product error:', err);
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message, errors: err.errors });
      }
      return res.status(500).json({ message: 'Server error' });
    }
  },

  list: async (req, res) => {
    try {
      const { category, collection, search, q, sort } = req.query || {};
      const page = parsePositiveInt(req.query && req.query.page, 1);
      const limit = parsePositiveInt(req.query && req.query.limit, 20);
      const skip = (page - 1) * limit;

      const andFilters = [];
      if (category) {
        if (mongoose.Types.ObjectId.isValid(category)) {
          andFilters.push({
            $or: [{ categoryId: category }, { category: new RegExp(`^${category}$`, 'i') }]
          });
        } else {
          andFilters.push({ category: { $regex: category, $options: 'i' } });
        }
      }
      if (collection) andFilters.push({ collection: { $regex: collection, $options: 'i' } });
      if (search || q) {
        const text = search || q;
        andFilters.push({
          $or: [
          { name: { $regex: text, $options: 'i' } },
          { description: { $regex: text, $options: 'i' } }
          ]
        });
      }
      const filter = andFilters.length ? { $and: andFilters } : {};

      let sortSpec = { createdAt: -1 };
      switch (sort) {
        case 'price_asc':
          sortSpec = { price: 1 };
          break;
        case 'price_desc':
          sortSpec = { price: -1 };
          break;
        case 'rating_desc':
          sortSpec = { rating: -1, reviewCount: -1 };
          break;
        case 'popular':
          sortSpec = { isBestSeller: -1, addedToCartCount: -1, viewCount: -1 };
          break;
        case 'newest':
          sortSpec = { createdAt: -1 };
          break;
        default:
          break;
      }

      const [products, total] = await Promise.all([
        Product.find(filter).sort(sortSpec).skip(skip).limit(limit),
        Product.countDocuments(filter)
      ]);

      return res.status(200).json({
        products: products.map((p) => toProductResponse(p)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      });
    } catch (err) {
      console.error('List products error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  trending: async (_req, res) => {
    try {
      const products = await Product.find({}).sort({ trendingScore: -1, addedToCartCount: -1, viewCount: -1, createdAt: -1 }).limit(12);
      return res.status(200).json({ products: products.map((p) => toProductResponse(p)) });
    } catch (err) {
      console.error('Trending products error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  get: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      product.viewCount = Number(product.viewCount || 0) + 1;
      await product.save();
      return res.status(200).json({ product: toProductResponse(product) });
    } catch (err) {
      console.error('Get product error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  update: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const { id } = req.params;
      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      const updatable = [
        'name',
        'description',
        'category',
        'collection',
        'price',
        'originalPrice',
        'mrp',
        'images',
        'stock',
        'isNew',
        'isBestSeller',
        'isLimited',
        'rating',
        'reviewCount',
        'sizes',
        'variants',
        'colors',
        'dropDate',
        'releaseDate',
        'viewCount',
        'addedToCartCount',
        'trendingScore',
        'productSpecifications',
        'categoryId'
      ];

      if (req.body.categoryId !== undefined && req.body.categoryId !== null && !mongoose.Types.ObjectId.isValid(req.body.categoryId)) {
        return res.status(400).json({ message: 'Invalid categoryId' });
      }

      updatable.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (['images', 'sizes', 'colors'].includes(field)) {
            product[field] = asArray(req.body[field]);
          } else {
            product[field] = req.body[field];
          }
        }
      });

      await product.save();
      return res.status(200).json({ message: 'Product updated', product: toProductResponse(product) });
    } catch (err) {
      console.error('Update product error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  delete: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const { id } = req.params;
      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      await Product.findByIdAndDelete(id);
      return res.status(200).json({ message: 'Product deleted' });
    } catch (err) {
      console.error('Delete product error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
