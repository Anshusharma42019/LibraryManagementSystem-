const Seat = require('../models/Seat');
const Student = require('../models/Student');

const getLibraryId = (req) =>
  req.user.role === 'superadmin' ? req.query.libraryId || req.body.libraryId : req.user.libraryId;

// @GET /api/seats
const getAllSeats = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { status, floor, section } = req.query;

    const query = { libraryId };
    if (status) query.status = status;
    if (floor) query.floor = floor;
    if (section) query.section = section;

    const seats = await Seat.find(query)
      .populate('currentStudent', 'name mobile')
      .sort({ seatNo: 1 });

    const stats = {
      total: seats.length,
      available: seats.filter(s => s.status === 'available').length,
      occupied: seats.filter(s => s.status === 'occupied').length,
      reserved: seats.filter(s => s.status === 'reserved').length,
      maintenance: seats.filter(s => s.status === 'maintenance').length,
    };

    res.status(200).json({ success: true, data: seats, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/seats
const createSeat = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { seatNo } = req.body;

    const existing = await Seat.findOne({ libraryId, seatNo });
    if (existing) {
      return res.status(400).json({ success: false, message: `Seat ${seatNo} already exists.` });
    }

    const seat = await Seat.create({ ...req.body, libraryId });
    res.status(201).json({ success: true, message: 'Seat created.', data: seat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/seats/bulk
const bulkCreateSeats = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { prefix, startNo, count, floor, section, type, monthlyRent } = req.body;

    if (!count || count < 1 || count > 500) {
      return res.status(400).json({ success: false, message: 'Count must be between 1 and 500.' });
    }

    const seats = [];
    const errors = [];

    for (let i = 0; i < parseInt(count); i++) {
      const seatNo = `${prefix || 'A'}-${String(parseInt(startNo || 1) + i).padStart(2, '0')}`;
      const exists = await Seat.findOne({ libraryId, seatNo });
      if (exists) {
        errors.push(seatNo);
        continue;
      }
      seats.push({ libraryId, seatNo, floor: floor || 'Ground', section: section || 'A', type: type || 'standard', monthlyRent: monthlyRent || 0 });
    }

    if (seats.length > 0) await Seat.insertMany(seats);

    res.status(201).json({
      success: true,
      message: `${seats.length} seats created.${errors.length > 0 ? ` Skipped (already exist): ${errors.join(', ')}` : ''}`,
      data: { created: seats.length, skipped: errors },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/seats/:id
const updateSeat = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const seat = await Seat.findOneAndUpdate(
      { _id: req.params.id, libraryId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!seat) return res.status(404).json({ success: false, message: 'Seat not found.' });
    res.status(200).json({ success: true, message: 'Seat updated.', data: seat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/seats/:id
const deleteSeat = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const seat = await Seat.findOne({ _id: req.params.id, libraryId });
    if (!seat) return res.status(404).json({ success: false, message: 'Seat not found.' });

    if (seat.status === 'occupied') {
      return res.status(400).json({ success: false, message: 'Cannot delete an occupied seat. Remove the student first.' });
    }

    await seat.deleteOne();
    res.status(200).json({ success: true, message: 'Seat deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PATCH /api/seats/:id/assign
const assignSeat = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { studentId } = req.body;

    const seat = await Seat.findOne({ _id: req.params.id, libraryId });
    if (!seat) return res.status(404).json({ success: false, message: 'Seat not found.' });
    if (seat.status === 'occupied') return res.status(400).json({ success: false, message: 'Seat already occupied.' });

    const student = await Student.findOne({ _id: studentId, libraryId });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    // Free old seat if student had one
    if (student.seatId) {
      await Seat.findByIdAndUpdate(student.seatId, { status: 'available', currentStudent: null });
    }

    seat.status = 'occupied';
    seat.currentStudent = studentId;
    await seat.save();

    student.seatId = seat._id;
    student.seatNo = seat.seatNo;
    await student.save();

    res.status(200).json({ success: true, message: `Seat ${seat.seatNo} assigned to ${student.name}.`, data: seat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PATCH /api/seats/:id/unassign
const unassignSeat = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const seat = await Seat.findOne({ _id: req.params.id, libraryId });
    if (!seat) return res.status(404).json({ success: false, message: 'Seat not found.' });

    if (seat.currentStudent) {
      await Student.findByIdAndUpdate(seat.currentStudent, { seatId: null, seatNo: null });
    }

    seat.status = 'available';
    seat.currentStudent = null;
    await seat.save();

    res.status(200).json({ success: true, message: 'Seat unassigned.', data: seat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllSeats, createSeat, bulkCreateSeats, updateSeat, deleteSeat, assignSeat, unassignSeat };
