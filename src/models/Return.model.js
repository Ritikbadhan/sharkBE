const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    reason: { type: String, required: true },
    comment: { type: String },
    status: {
      type: String,
      enum: ['Requested', 'Approved', 'Rejected', 'Picked', 'Refunded'],
      default: 'Requested'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Return', returnSchema);
