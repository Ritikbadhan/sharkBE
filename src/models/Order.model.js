const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    size: {
      type: String
    },
    color: {
      type: String
    },
    price: {
      type: Number,
      required: true
    },
    image: {
      type: String
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    items: [orderItemSchema],

    shippingAddress: {
      name: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
      instructions: String
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "RAZORPAY", "STRIPE", "UPI", "WALLET"],
      required: true
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending"
    },

    orderStatus: {
      type: String,
      enum: ["Processing", "Shipped", "Delivered", "Cancelled", "Returned", "placed", "confirmed", "shipped", "delivered", "cancelled"],
      default: "Processing"
    },

    totalAmount: {
      type: Number,
      required: true
    },

    paymentId: {
      type: String
    },

    invoiceUrl: {
      type: String
    },

    trackingUrl: {
      type: String
    },

    returnEligible: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
