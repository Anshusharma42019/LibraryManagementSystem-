const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Library',
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: {
      type: String,
      enum: ['rent', 'electricity', 'internet', 'salary', 'maintenance', 'supplies', 'other'],
      default: 'other',
    },
    date: { type: Date, default: Date.now },
    paymentMode: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'cheque'],
      default: 'cash',
    },
    receipt: { type: String, default: null },
    notes: { type: String, default: null },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

expenseSchema.index({ libraryId: 1, date: -1 });
expenseSchema.index({ libraryId: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
