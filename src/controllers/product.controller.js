const Product = require('../models/Product.model');

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      let { name, description, price, stock, images, categoryId } = req.body || {};
      // ensure images is always an array when present (frontend might send a single string)
      if (images && !Array.isArray(images)) {
        images = [images];
      }
      if (!name || price === undefined) return res.status(400).json({ message: 'name and price are required' });

      // if categoryId is provided but not a valid ObjectId, try looking up by slug or name
      if (categoryId && !categoryId.match(/^[0-9a-fA-F]{24}$/)) {
        const Category = require('../models/Category.model');
        const cat = await Category.findOne({ slug: categoryId }) || await Category.findOne({ name: categoryId });
        if (cat) {
          categoryId = cat._id;
        } else {
          // leave invalid value and let mongoose validation handle it
        }
      }

      const product = new Product({ name, description, price, stock, images, categoryId });
      await product.save();
      return res.status(201).json({ message: 'Product created', product });
    } catch (err) {
      console.error('Create product error:', err);
      // propagate validation messages in response
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message, errors: err.errors });
      }
      return res.status(500).json({ message: 'Server error' });
    }
  },

  list: async (req, res) => {
    try {
      const { category, q } = req.query || {};
      const filter = {};
      if (category) filter.categoryId = category;
      if (q) filter.name = { $regex: q, $options: 'i' };

      const products = await Product.find(filter).sort({ createdAt: -1 });
      return res.status(200).json({ products });
    } catch (err) {
      console.error('List products error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  get: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      return res.status(200).json({ product });
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

      const updatable = ['name', 'description', 'price', 'stock', 'images', 'categoryId'];
      updatable.forEach((f) => {
        if (req.body[f] !== undefined) {
          // coerce images to array when updating
          if (f === 'images' && req.body.images && !Array.isArray(req.body.images)) {
            product.images = [req.body.images];
          } else {
            product[f] = req.body[f];
          }
        }
      });

      await product.save();
      return res.status(200).json({ message: 'Product updated', product });
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
  },
};
