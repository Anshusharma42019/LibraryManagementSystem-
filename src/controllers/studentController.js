const Student = require('../models/Student');
const Seat = require('../models/Seat');
const Library = require('../models/Library');
const mongoose = require('mongoose');

// Helper: get libraryId based on role
const getLibraryId = (req) => {
  const id = req.user.role === 'superadmin'
    ? req.query.libraryId || req.body.libraryId
    : req.user.libraryId;
  return id ? new mongoose.Types.ObjectId(id) : null;
};

// @GET /api/students
const getAllStudents = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { status, search, page = 1, limit = 20, shift } = req.query;

    const query = { libraryId };
    if (status) query.status = status;
    if (shift) query.shift = shift;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { seatNo: { $regex: search, $options: 'i' } },
        { studentCode: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        students,
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/students/:id
const getStudent = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const student = await Student.findOne({ _id: req.params.id, libraryId }).populate('seatId');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/students
const createStudent = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);

    // Check seat limit
    const library = await Library.findById(libraryId);
    const activeCount = await Student.countDocuments({ libraryId, status: 'active' });

    if (activeCount >= library.totalSeatsAllowed) {
      return res.status(400).json({
        success: false,
        message: `Seat limit reached. Your plan allows ${library.totalSeatsAllowed} students. Please upgrade.`,
      });
    }

    // Auto-generate student code
    const count = await Student.countDocuments({ libraryId });
    const studentCode = `STU-${String(count + 1).padStart(4, '0')}`;

    const student = await Student.create({ ...req.body, libraryId, studentCode });

    // Mark seat as occupied if seatId provided
    if (req.body.seatId) {
      await Seat.findByIdAndUpdate(req.body.seatId, {
        status: 'occupied',
        currentStudent: student._id,
      });
    }

    // Update library student count
    await Library.findByIdAndUpdate(libraryId, {
      $inc: { totalStudents: 1, activeStudents: 1 },
    });

    res.status(201).json({ success: true, message: 'Student added successfully.', data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/students/:id — whitelist fields
const updateStudent = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const allowed = ['name', 'mobile', 'email', 'fatherName', 'address', 'photo', 'idProof',
      'idProofType', 'seatNo', 'seatId', 'shift', 'shiftTime', 'monthlyFee', 'depositAmount',
      'depositRefunded', 'feesDueDate', 'expiryDate', 'status', 'notes'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, libraryId },
      updates,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    res.status(200).json({ success: true, message: 'Student updated.', data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/students/:id
const deleteStudent = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, libraryId },
      { status: 'left' },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Free the seat
    if (student.seatId) {
      await Seat.findByIdAndUpdate(student.seatId, {
        status: 'available',
        currentStudent: null,
      });
    }

    await Library.findByIdAndUpdate(libraryId, { $inc: { activeStudents: -1 } });

    res.status(200).json({ success: true, message: 'Student removed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/students/expiring
const getExpiringStudents = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const days = parseInt(req.query.days) || 7;
    const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const students = await Student.find({
      libraryId,
      status: 'active',
      expiryDate: { $lte: futureDate, $gte: new Date() },
    }).sort({ expiryDate: 1 });

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/students/pending-fees
const getPendingFees = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);

    const students = await Student.aggregate([
      { $match: { libraryId: libraryId, status: 'active' } },
      {
        $lookup: {
          from: 'payments',
          let: { studentId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$studentId', '$$studentId'] },
                status: 'paid',
                forMonth: {
                  $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
              },
            },
          ],
          as: 'currentMonthPayments',
        },
      },
      { $match: { currentMonthPayments: { $size: 0 } } },
      { $project: { name: 1, mobile: 1, seatNo: 1, monthlyFee: 1, feesDueDate: 1 } },
    ]);

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getExpiringStudents,
  getPendingFees,
};
