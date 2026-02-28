const mongoose = require("mongoose");

const paymentMethodSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true },
    label: { type: String, trim: true },
    maskedValue: { type: String, trim: true },
    isDefault: { type: Boolean, default: false }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    phone: { type: String },
    phoneVerified: { type: Boolean, default: false },
    smsVerificationCode: { type: String },
    smsVerificationExpires: { type: Date },
    emailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String },
    emailVerificationExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    rewards: {
      points: { type: Number, default: 0 },
      tier: { type: String, default: "Bronze" }
    },
    paymentMethods: { type: [paymentMethodSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
