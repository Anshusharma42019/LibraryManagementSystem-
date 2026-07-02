const Student = require('../models/Student');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Attendance = require('../models/Attendance');
const Seat = require('../models/Seat');
const Library = require('../models/Library');
const mongoose = require('mongoose');

const getLibraryId = (req) => {
  const id = req.user.role === 'superadmin' ? req.query.libraryId : req.user.libraryId;
  return id ? new mongoose.Types.ObjectId(id) : null;
};

// @GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalStudents,
      activeStudents,
      expiringStudents,
      monthlyRevenue,
      totalSeats,
      occupiedSeats,
      monthlyExpense,
      todayAttendance,
      recentPayments,
    ] = await Promise.all([
      Student.countDocuments({ libraryId }),
      Student.countDocuments({ libraryId, status: 'active' }),
      Student.countDocuments({ libraryId, status: 'active', expiryDate: { $lte: sevenDaysLater, $gte: now } }),
      Payment.aggregate([
        { $match: { libraryId, status: 'paid', paidAt: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Seat.countDocuments({ libraryId }),
      Seat.countDocuments({ libraryId, status: 'occupied' }),
      Expense.aggregate([
        { $match: { libraryId, date: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Attendance.countDocuments({ libraryId, date: { $gte: todayStart, $lte: todayEnd }, status: 'present' }),
      Payment.find({ libraryId, status: 'paid' })
        .sort({ paidAt: -1 })
        .limit(5)
        .populate('studentId', 'name seatNo'),
    ]);

    // Monthly revenue chart - last 6 months (single aggregation)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [revenueChart, expenseChart] = await Promise.all([
      Payment.aggregate([
        { $match: { libraryId, status: 'paid', paidAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { libraryId, date: { $gte: sixMonthsAgo } } },
        { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, total: { $sum: '$amount' } } },
      ]),
    ]);

    const monthlyChart = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      const yr = new Date(d.getFullYear(), d.getMonth() - i, 1).getFullYear();
      const mo = new Date(d.getFullYear(), d.getMonth() - i, 1).getMonth() + 1;
      const rev = revenueChart.find(r => r._id.year === yr && r._id.month === mo);
      const exp = expenseChart.find(r => r._id.year === yr && r._id.month === mo);
      monthlyChart.push({
        month: new Date(yr, mo - 1, 1).toLocaleString('default', { month: 'short' }),
        revenue: rev?.total || 0,
        expenses: exp?.total || 0,
      });
    }

    const revenue = monthlyRevenue[0] || { total: 0, count: 0 };
    const expense = monthlyExpense[0] || { total: 0 };

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalStudents,
          activeStudents,
          expiringStudents,
          monthlyRevenue: revenue.total,
          paymentsThisMonth: revenue.count,
          monthlyExpense: expense.total,
          netProfit: revenue.total - expense.total,
          totalSeats,
          occupiedSeats,
          availableSeats: totalSeats - occupiedSeats,
          todayAttendance,
        },
        monthlyChart,
        recentPayments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/library/settings
const updateLibrarySettings = async (req, res) => {
  try {
    const libraryId = req.user.libraryId;
    const allowed = ['name', 'mobile', 'address', 'city', 'state', 'pincode', 'gst', 'settings'];
    const updates = {};
    allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

    const library = await Library.findByIdAndUpdate(libraryId, updates, { new: true });
    res.status(200).json({ success: true, message: 'Settings updated.', data: library });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboard, updateLibrarySettings };
