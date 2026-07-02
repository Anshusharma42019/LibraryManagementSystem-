const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Library',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    studentName: { type: String },
    seatNo: { type: String },

    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    paymentType: {
      type: String,
      enum: ['monthly_fee', 'deposit', 'fine', 'other'],
      default: 'monthly_fee',
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'upi', 'online', 'bank_transfer', 'cheque'],
      default: 'cash',
    },
    paymentMonth: { type: String }, // "January 2024"
    forMonth: { type: Date },       // Actual date for filtering

    status: {
      type: String,
      enum: ['paid', 'pending', 'partial', 'refunded'],
      default: 'paid',
    },

    receiptNo: { type: String, unique: true },
    transactionId: { type: String, default: null },
    notes: { type: String, default: null },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

paymentSchema.index({ libraryId: 1, studentId: 1 });
paymentSchema.index({ libraryId: 1, status: 1 });
paymentSchema.index({ libraryId: 1, paidAt: -1 });

// Auto-generate receipt number
paymentSchema.pre('save', async function (next) {
  if (!this.receiptNo) {
    const count = await this.constructor.countDocuments({ libraryId: this.libraryId });
    const prefix = 'RCP';
    this.receiptNo = `${prefix}-${Date.now()}-${count + 1}`;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
