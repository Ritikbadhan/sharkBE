const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    landmark: { type: String, trim: true },
    instructions: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    // Backward compatibility fields
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Address', addressSchema);
