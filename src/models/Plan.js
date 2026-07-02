const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['Starter', 'Basic', 'Professional', 'Enterprise'],
      required: true,
      unique: true,
    },
    price: { type: Number, required: true },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly',
    },
    maxSeats: { type: Number, default: 50 },
    maxStaff: { type: Number, default: 1 },
    features: {
      whatsappNotifications: { type: Boolean, default: false },
      smsNotifications: { type: Boolean, default: false },
      customDomain: { type: Boolean, default: false },
      qrIdCards: { type: Boolean, default: true },
      receiptPrinting: { type: Boolean, default: true },
      expenseTracking: { type: Boolean, default: false },
      advancedReports: { type: Boolean, default: false },
      multipleStaff: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      autoBackup: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    description: { type: String },
    tag: { type: String, default: null }, // e.g. "Most Popular"
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
