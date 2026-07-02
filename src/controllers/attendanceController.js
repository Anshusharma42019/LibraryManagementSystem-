const Attendance = require('../models/Attendance');
const Student = require('../models/Student');

const getLibraryId = (req) =>
  req.user.role === 'superadmin' ? req.query.libraryId || req.body.libraryId : req.user.libraryId;

// Helper: calculate slot end time
const addHoursToTime = (timeStr, hours) => {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

// Helper: get today's date range
const getTodayRange = (dateStr) => {
  const start = dateStr ? new Date(dateStr) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// @GET /api/attendance
const getAttendance = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { date, studentId } = req.query;

    const query = { libraryId };
    if (studentId) query.studentId = studentId;

    if (date) {
      const { start, end } = getTodayRange(date);
      query.date = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(query)
      .populate('studentId', 'name mobile seatNo shift shiftTime')
      .sort({ date: -1 });

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/attendance  — bulk mark for a day (present/absent)
const markAttendance = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { date, records } = req.body;

    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'date and records array are required.' });
    }

    const { start: dayStart, end: dayEnd } = getTodayRange(date);

    const ops = records.map(r => ({
      updateOne: {
        filter: { libraryId, studentId: r.studentId, date: { $gte: dayStart, $lte: dayEnd } },
        update: {
          $set: {
            libraryId,
            studentId: r.studentId,
            date: new Date(date),
            status: r.status || 'present',
            markedBy: 'manual',
          },
        },
        upsert: true,
      },
    }));

    await Attendance.bulkWrite(ops);
    res.status(200).json({ success: true, message: `Attendance saved for ${records.length} students.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/attendance/checkin  — student check-in with optional slot booking
const checkIn = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { studentId, bookedSlotHours, slotStartTime, notes } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'studentId is required.' });
    }

    const student = await Student.findOne({ _id: studentId, libraryId, status: 'active' });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found or inactive.' });
    }

    const now = new Date();
    const { start: dayStart, end: dayEnd } = getTodayRange();

    // Check if already checked in today
    const existing = await Attendance.findOne({
      libraryId,
      studentId,
      date: { $gte: dayStart, $lte: dayEnd },
    });

    if (existing && existing.checkIn && !existing.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Student is already checked in. Please check out first.',
        data: existing,
      });
    }

    // Calculate slot end time if slot booking
    let slotEndTime = null;
    if (bookedSlotHours && slotStartTime) {
      slotEndTime = addHoursToTime(slotStartTime, bookedSlotHours);
    } else if (bookedSlotHours) {
      // Use current time as slot start
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const startStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      slotEndTime = addHoursToTime(startStr, bookedSlotHours);
    }

    const startTimeStr = slotStartTime ||
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let record;
    if (existing) {
      // Re-checkin (previous was checked out)
      existing.checkIn = now;
      existing.checkOut = null;
      existing.status = 'present';
      existing.markedBy = 'checkin';
      existing.bookedSlotHours = bookedSlotHours || null;
      existing.slotStartTime = startTimeStr;
      existing.slotEndTime = slotEndTime;
      existing.notes = notes || existing.notes;
      await existing.save();
      record = existing;
    } else {
      record = await Attendance.create({
        libraryId,
        studentId,
        date: now,
        checkIn: now,
        status: 'present',
        markedBy: 'checkin',
        bookedSlotHours: bookedSlotHours || null,
        slotStartTime: startTimeStr,
        slotEndTime,
        notes: notes || null,
      });
    }

    await record.populate('studentId', 'name mobile seatNo shift');

    res.status(200).json({
      success: true,
      message: `${student.name} checked in at ${startTimeStr}${bookedSlotHours ? ` for ${bookedSlotHours} hours (till ${slotEndTime})` : ''}.`,
      data: record,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/attendance/checkout  — student check-out
const checkOut = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'studentId is required.' });
    }

    const { start: dayStart, end: dayEnd } = getTodayRange();

    const record = await Attendance.findOne({
      libraryId,
      studentId,
      date: { $gte: dayStart, $lte: dayEnd },
      checkIn: { $ne: null },
      checkOut: null,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No active check-in found for this student today.',
      });
    }

    const now = new Date();
    record.checkOut = now;

    // Calculate total hours
    const diffMs = now - record.checkIn;
    const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    record.totalHours = totalHours;

    // Update status based on hours
    if (totalHours >= 6) {
      record.status = 'present';
    } else if (totalHours >= 2) {
      record.status = 'half_day';
    } else {
      record.status = 'present'; // short visit still counts
    }

    await record.save();
    await record.populate('studentId', 'name mobile seatNo');

    const checkoutTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    res.status(200).json({
      success: true,
      message: `${record.studentId.name} checked out at ${checkoutTime}. Total: ${totalHours} hrs.`,
      data: record,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/attendance/book-slot  — advance slot booking
const bookSlot = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { studentId, date, bookedSlotHours, slotStartTime, notes } = req.body;

    if (!studentId || !date || !bookedSlotHours || !slotStartTime) {
      return res.status(400).json({
        success: false,
        message: 'studentId, date, bookedSlotHours, and slotStartTime are required.',
      });
    }

    const validSlots = [2, 3, 4, 6, 8, 12];
    if (!validSlots.includes(Number(bookedSlotHours))) {
      return res.status(400).json({
        success: false,
        message: `bookedSlotHours must be one of: ${validSlots.join(', ')}`,
      });
    }

    const student = await Student.findOne({ _id: studentId, libraryId, status: 'active' });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found or inactive.' });
    }

    const { start: dayStart, end: dayEnd } = getTodayRange(date);

    const existing = await Attendance.findOne({
      libraryId,
      studentId,
      date: { $gte: dayStart, $lte: dayEnd },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A booking or attendance already exists for this date.',
        data: existing,
      });
    }

    const slotEndTime = addHoursToTime(slotStartTime, Number(bookedSlotHours));

    const record = await Attendance.create({
      libraryId,
      studentId,
      date: new Date(date),
      status: 'booked',
      markedBy: 'manual',
      bookedSlotHours: Number(bookedSlotHours),
      slotStartTime,
      slotEndTime,
      notes: notes || null,
    });

    await record.populate('studentId', 'name mobile seatNo shift');

    res.status(201).json({
      success: true,
      message: `Slot booked for ${student.name}: ${slotStartTime} – ${slotEndTime} (${bookedSlotHours} hrs) on ${date}.`,
      data: record,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/attendance/report  — monthly report for a student
const getAttendanceReport = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { studentId, month, year } = req.query;

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const query = { libraryId, date: { $gte: start, $lte: end } };
    if (studentId) query.studentId = studentId;

    const records = await Attendance.find(query)
      .populate('studentId', 'name seatNo shift');

    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const halfDayCount = records.filter(r => r.status === 'half_day').length;
    const bookedCount = records.filter(r => r.status === 'booked').length;
    const totalHours = records.reduce((sum, r) => sum + (r.totalHours || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        records,
        summary: {
          present: presentCount,
          absent: absentCount,
          half_day: halfDayCount,
          booked: bookedCount,
          totalHours: parseFloat(totalHours.toFixed(2)),
          total: records.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/attendance/today-summary
const getTodaySummary = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { start, end } = getTodayRange();

    const [totalActive, todayRecords] = await Promise.all([
      Student.countDocuments({ libraryId, status: 'active' }),
      Attendance.find({ libraryId, date: { $gte: start, $lte: end } })
        .populate('studentId', 'name mobile seatNo shift'),
    ]);

    const present = todayRecords.filter(r => r.status === 'present').length;
    const absent = todayRecords.filter(r => r.status === 'absent').length;
    const halfDay = todayRecords.filter(r => r.status === 'half_day').length;
    const booked = todayRecords.filter(r => r.status === 'booked').length;
    const checkedIn = todayRecords.filter(r => r.checkIn && !r.checkOut).length;
    const notMarked = totalActive - todayRecords.length;

    res.status(200).json({
      success: true,
      data: {
        totalActive,
        present,
        absent,
        halfDay,
        booked,
        checkedIn,
        notMarked,
        markedCount: todayRecords.length,
        records: todayRecords,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/attendance/active-checkins  — currently inside students
const getActiveCheckIns = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { start, end } = getTodayRange();

    const records = await Attendance.find({
      libraryId,
      date: { $gte: start, $lte: end },
      checkIn: { $ne: null },
      checkOut: null,
    }).populate('studentId', 'name mobile seatNo shift shiftTime');

    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAttendance,
  markAttendance,
  checkIn,
  checkOut,
  bookSlot,
  getAttendanceReport,
  getTodaySummary,
  getActiveCheckIns,
};
