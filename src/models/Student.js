const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    // Tenant isolation - MOST IMPORTANT FIELD
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Library',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    email: { type: String, lowercase: true, default: null },
    fatherName: { type: String, default: null },
    address: { type: String, default: null },
    photo: { type: String, default: null },
    idProof: { type: String, default: null },
    idProofType: {
      type: String,
      enum: ['aadhar', 'pan', 'voter', 'passport', 'other'],
      default: 'aadhar',
    },

    // Seat Assignment
    seatNo: {
      type: String,
      default: null,
    },
    seatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seat',
      default: null,
    },

    // Shift
    shift: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'fullday', 'custom'],
      default: 'fullday',
    },
    shiftTime: {
      start: { type: String, default: '06:00' },
      end: { type: String, default: '22:00' },
    },

    // Fee Details
    monthlyFee: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    depositRefunded: { type: Boolean, default: false },
    feesDueDate: { type: Number, default: 1 }, // Day of month

    // Dates
    admissionDate: { type: Date, default: Date.now },
    expiryDate: { type: Date },

    // Status
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired', 'left'],
      default: 'active',
    },

    // Auto-generated student ID per library
    studentCode: { type: String },

    // Student self-login PIN (4-digit, set by owner or student)
    pin: { type: String, default: null, select: false },

    notes: { type: String, default: null },
  },
  { timestamps: true }
);

// Compound index for fast tenant queries
studentSchema.index({ libraryId: 1, status: 1 });
studentSchema.index({ libraryId: 1, seatId: 1 });
studentSchema.index({ libraryId: 1, mobile: 1 });

module.exports = mongoose.model('Student', studentSchema);
