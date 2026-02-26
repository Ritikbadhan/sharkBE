const Category = require('../models/Category.model');

module.exports = {
  create: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const { name, slug, isActive } = req.body || {};
      if (!name) return res.status(400).json({ message: 'name is required' });

      const existing = await Category.findOne({ slug });
      if (slug && existing) return res.status(409).json({ message: 'Slug already in use' });

      const category = new Category({ name, slug, isActive });
      await category.save();
      return res.status(201).json({ message: 'Category created', category });
    } catch (err) {
      console.error('Create category error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  list: async (req, res) => {
    try {
      const categories = await Category.find({ isActive: true }).sort({ createdAt: -1 });
      return res.status(200).json({ categories });
    } catch (err) {
      console.error('List categories error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  update: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const { id } = req.params;
      const { name, slug, isActive } = req.body || {};

      const category = await Category.findById(id);
      if (!category) return res.status(404).json({ message: 'Category not found' });

      if (slug && slug !== category.slug) {
        const existing = await Category.findOne({ slug });
        if (existing) return res.status(409).json({ message: 'Slug already in use' });
      }

      if (name !== undefined) category.name = name;
      if (slug !== undefined) category.slug = slug;
      if (isActive !== undefined) category.isActive = isActive;

      await category.save();
      return res.status(200).json({ message: 'Category updated', category });
    } catch (err) {
      console.error('Update category error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  delete: async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const { id } = req.params;
      const category = await Category.findById(id);
      if (!category) return res.status(404).json({ message: 'Category not found' });
      await Category.findByIdAndDelete(id);
      return res.status(200).json({ message: 'Category deleted' });
    } catch (err) {
      console.error('Delete category error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
