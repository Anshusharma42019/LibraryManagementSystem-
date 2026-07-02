const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
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
    date: { type: Date, required: true },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    totalHours: { type: Number, default: 0 },
    // Slot-based booking: student books 2/3/4 hours
    bookedSlotHours: { type: Number, enum: [2, 3, 4, 6, 8, 12], default: null },
    slotStartTime: { type: String, default: null }, // e.g. "09:00"
    slotEndTime: { type: String, default: null },   // e.g. "11:00" (auto-calculated)
    status: {
      type: String,
      enum: ['present', 'absent', 'half_day', 'holiday', 'booked'],
      default: 'present',
    },
    markedBy: {
      type: String,
      enum: ['manual', 'qr', 'auto', 'checkin'],
      default: 'manual',
    },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

attendanceSchema.index({ libraryId: 1, date: -1 });
attendanceSchema.index({ libraryId: 1, studentId: 1, date: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
