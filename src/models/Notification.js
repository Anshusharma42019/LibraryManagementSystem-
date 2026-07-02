const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // null libraryId = broadcast from superadmin to all
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Library',
      default: null,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['info', 'warning', 'success', 'error', 'fee_reminder', 'expiry', 'broadcast'],
      default: 'info',
    },
    targetRole: {
      type: String,
      enum: ['all', 'owner', 'staff', 'superadmin'],
      default: 'owner',
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    sentVia: {
      inApp: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

notificationSchema.index({ libraryId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
