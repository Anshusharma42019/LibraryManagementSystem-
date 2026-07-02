const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Library',
      required: true,
      index: true,
    },
    seatNo: {
      type: String,
      required: true,
    },
    floor: { type: String, default: 'Ground' },
    section: { type: String, default: 'A' },
    type: {
      type: String,
      enum: ['standard', 'premium', 'cabin', 'window'],
      default: 'standard',
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'maintenance'],
      default: 'available',
    },
    currentStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    // For shift-based seat sharing
    shifts: {
      morning: {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
        isOccupied: { type: Boolean, default: false },
      },
      afternoon: {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
        isOccupied: { type: Boolean, default: false },
      },
      evening: {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
        isOccupied: { type: Boolean, default: false },
      },
    },
    monthlyRent: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

seatSchema.index({ libraryId: 1, seatNo: 1 }, { unique: true });
seatSchema.index({ libraryId: 1, status: 1 });

module.exports = mongoose.model('Seat', seatSchema);
