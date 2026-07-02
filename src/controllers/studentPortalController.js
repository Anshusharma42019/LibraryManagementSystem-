const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const jwt = require('jsonwebtoken');

// ── Helper: generate student token ──────────────────────────────────────────
const generateStudentToken = (studentId, libraryId) =>
  jwt.sign({ studentId, libraryId, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1d' });

// ── Helper: today date range ─────────────────────────────────────────────────
const getTodayRange = () => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
};

// @POST /api/student-portal/login
const studentLogin = async (req, res) => {
  try {
    const { studentCode, mobile, pin } = req.body;

    if (!pin) return res.status(400).json({ success: false, message: 'PIN is required.' });
    if (!studentCode && !mobile)
      return res.status(400).json({ success: false, message: 'Student code or mobile is required.' });

    const query = { status: 'active' };
    if (studentCode) query.studentCode = studentCode.toUpperCase();
    else query.mobile = mobile;

    const student = await Student.findOne(query).select('+pin');

    // Timing-safe PIN check
    const bcrypt = require('bcryptjs');
    const dummyHash = '$2a$10$dummyhashfordummycomparison0000000000000000000000000';
    const pinMatch = student?.pin
      ? await bcrypt.compare(pin, student.pin)
      : await bcrypt.compare(pin, dummyHash);

    if (!student || !pinMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateStudentToken(student._id, student.libraryId);

    // Check today's status
    const { start, end } = getTodayRange();
    const todayRecord = await Attendance.findOne({
      libraryId: student.libraryId,
      studentId: student._id,
      date: { $gte: start, $lte: end },
    });

    const isCheckedIn = !!(todayRecord?.checkIn && !todayRecord?.checkOut);

    res.status(200).json({
      success: true,
      message: `Welcome, ${student.name}!`,
      data: {
        token,
        student: {
          _id: student._id,
          name: student.name,
          studentCode: student.studentCode,
          mobile: student.mobile,
          seatNo: student.seatNo,
          shift: student.shift,
          shiftTime: student.shiftTime,
          expiryDate: student.expiryDate,
          monthlyFee: student.monthlyFee,
          libraryId: student.libraryId,
          status: student.status,
        },
        todayStatus: {
          isCheckedIn,
          checkIn: todayRecord?.checkIn || null,
          checkOut: todayRecord?.checkOut || null,
          totalHours: todayRecord?.totalHours || 0,
          status: todayRecord?.status || null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Middleware: verify student token ─────────────────────────────────────────
const protectStudent = (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer'))
      token = req.headers.authorization.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'Access denied.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'student')
      return res.status(403).json({ success: false, message: 'Not a student token.' });

    req.studentId = decoded.studentId;
    req.libraryId = decoded.libraryId;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// @POST /api/student-portal/checkin
const studentCheckIn = async (req, res) => {
  try {
    const { studentId, libraryId } = req;
    const student = await Student.findOne({ _id: studentId, libraryId, status: 'active' });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const now = new Date();
    const { start, end } = getTodayRange();

    const existing = await Attendance.findOne({
      libraryId, studentId, date: { $gte: start, $lte: end },
    });

    if (existing?.checkIn && !existing?.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'You are already checked in.',
        data: existing,
      });
    }

    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    let record;

    if (existing) {
      existing.checkIn  = now;
      existing.checkOut = null;
      existing.status   = 'present';
      existing.markedBy = 'checkin';
      existing.slotStartTime = timeStr;
      await existing.save();
      record = existing;
    } else {
      record = await Attendance.create({
        libraryId, studentId,
        date: now, checkIn: now,
        status: 'present', markedBy: 'checkin',
        slotStartTime: timeStr,
      });
    }

    res.status(200).json({
      success: true,
      message: `Checked in at ${timeStr}. Have a productive session! 📚`,
      data: { checkIn: record.checkIn, slotStartTime: timeStr },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/student-portal/checkout
const studentCheckOut = async (req, res) => {
  try {
    const { studentId, libraryId } = req;
    const { start, end } = getTodayRange();

    const record = await Attendance.findOne({
      libraryId, studentId,
      date: { $gte: start, $lte: end },
      checkIn: { $ne: null }, checkOut: null,
    });

    if (!record)
      return res.status(404).json({ success: false, message: 'No active check-in found for today.' });

    const now = new Date();
    record.checkOut = now;
    const diffMs = now - record.checkIn;
    const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    record.totalHours = totalHours;
    record.status = totalHours >= 6 ? 'present' : totalHours >= 2 ? 'half_day' : 'present';
    await record.save();

    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    res.status(200).json({
      success: true,
      message: `Checked out at ${timeStr}. Total: ${totalHours} hrs. See you tomorrow! 👋`,
      data: { checkOut: record.checkOut, totalHours, status: record.status },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/student-portal/me
const getStudentMe = async (req, res) => {
  try {
    const { studentId, libraryId } = req;
    const student = await Student.findOne({ _id: studentId, libraryId });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const { start, end } = getTodayRange();
    const todayRecord = await Attendance.findOne({
      libraryId, studentId, date: { $gte: start, $lte: end },
    });

    res.status(200).json({
      success: true,
      data: {
        student,
        todayStatus: {
          isCheckedIn: !!(todayRecord?.checkIn && !todayRecord?.checkOut),
          checkIn: todayRecord?.checkIn || null,
          checkOut: todayRecord?.checkOut || null,
          totalHours: todayRecord?.totalHours || 0,
          status: todayRecord?.status || null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/student-portal/attendance?month=7&year=2025
const getMyAttendance = async (req, res) => {
  try {
    const { studentId, libraryId } = req;
    const m = parseInt(req.query.month) || new Date().getMonth() + 1;
    const y = parseInt(req.query.year)  || new Date().getFullYear();

    const start = new Date(y, m - 1, 1);
    const end   = new Date(y, m, 0, 23, 59, 59);

    const records = await Attendance.find({
      libraryId, studentId, date: { $gte: start, $lte: end },
    }).sort({ date: 1 });

    const present  = records.filter(r => r.status === 'present').length;
    const halfDay  = records.filter(r => r.status === 'half_day').length;
    const absent   = records.filter(r => r.status === 'absent').length;
    const booked   = records.filter(r => r.status === 'booked').length;
    const totalHrs = records.reduce((s, r) => s + (r.totalHours || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        records,
        summary: { present, halfDay, absent, booked, totalHours: parseFloat(totalHrs.toFixed(2)), total: records.length },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/student-portal/payments
const getMyPayments = async (req, res) => {
  try {
    const { studentId, libraryId } = req;
    const payments = await Payment.find({ libraryId, studentId, status: 'paid' })
      .sort({ paidAt: -1 }).limit(12);

    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/student-portal/set-pin
const setPin = async (req, res) => {
  try {
    const { studentId, pin } = req.body;
    if (!studentId || !pin) return res.status(400).json({ success: false, message: 'studentId and pin required.' });
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ success: false, message: 'PIN must be exactly 4 digits.' });

    const bcrypt = require('bcryptjs');
    const hashedPin = await bcrypt.hash(pin, 10);
    await Student.findByIdAndUpdate(studentId, { pin: hashedPin });
    res.status(200).json({ success: true, message: 'PIN set successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  studentLogin,
  protectStudent,
  studentCheckIn,
  studentCheckOut,
  getStudentMe,
  getMyAttendance,
  getMyPayments,
  setPin,
};
