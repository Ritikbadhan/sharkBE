const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    stock: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, default: "" },
    collection: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    mrp: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    images: { type: [String], default: [] },
    isNew: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isLimited: { type: Boolean },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    sizes: { type: [String], default: [] },
    variants: { type: [variantSchema], default: [] },
    colors: { type: [String], default: [] },
    viewCount: { type: Number, default: 0, min: 0 },
    addedToCartCount: { type: Number, default: 0, min: 0 },
    trendingScore: { type: Number, default: 0 },
    dropDate: { type: Date },
    releaseDate: { type: Date },
    productSpecifications: {
      fit: { type: String },
      material: { type: String },
      pattern: { type: String },
      neckline: { type: String },
      sleeveType: { type: String },
      closure: { type: String },
      occasion: { type: [String], default: [] },
      season: { type: [String], default: [] },
      countryOfOrigin: { type: String },
      fabricWeightGsm: { type: Number },
      careInstructions: { type: [String], default: [] },
      sizeAndFit: {
        modelHeight: { type: String },
        modelWearing: { type: String },
        fitNote: { type: String }
      },
      measurementsCm: { type: mongoose.Schema.Types.Mixed, default: {} },
      manufacturingDetails: {
        fabricSource: { type: String },
        stitchType: { type: String },
        buttonType: { type: String },
        lining: { type: String }
      }
    },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);