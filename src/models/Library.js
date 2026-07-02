const mongoose = require('mongoose');

const librarySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Library name is required'],
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    mobile: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    gst: { type: String, default: null },
    logo: { type: String, default: null },
    customDomain: { type: String, default: null },

    // Subscription Details
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
    },
    planName: {
      type: String,
      enum: ['Starter', 'Basic', 'Professional', 'Enterprise'],
      default: 'Starter',
    },
    totalSeatsAllowed: {
      type: Number,
      default: 50,
    },
    subscriptionStart: { type: Date, default: Date.now },
    subscriptionExpiry: { type: Date },

    // Status
    status: {
      type: String,
      enum: ['active', 'expired', 'suspended', 'trial'],
      default: 'trial',
    },

    // Settings
    settings: {
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      feeReminderDays: { type: Number, default: 5 },
      autoExpireStudents: { type: Boolean, default: true },
      whatsappEnabled: { type: Boolean, default: false },
      smsEnabled: { type: Boolean, default: false },
    },

    // Analytics (cached)
    totalStudents: { type: Number, default: 0 },
    activeStudents: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Virtual: days remaining
librarySchema.virtual('daysRemaining').get(function () {
  if (!this.subscriptionExpiry) return 0;
  const diff = this.subscriptionExpiry - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

librarySchema.set('toJSON', { virtuals: true });
librarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Library', librarySchema);
