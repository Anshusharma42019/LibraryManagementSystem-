const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Library = require('../models/Library');
const mongoose = require('mongoose');

const getLibraryId = (req) => {
  const id = req.user.role === 'superadmin'
    ? req.query.libraryId || req.body.libraryId
    : req.user.libraryId;
  return id ? new mongoose.Types.ObjectId(id) : null;
};

// @GET /api/payments
const getAllPayments = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { studentId, status, month, page = 1, limit = 20 } = req.query;

    const query = { libraryId };
    if (studentId) query.studentId = studentId;
    if (status) query.status = status;
    if (month) {
      const date = new Date(month);
      query.forMonth = {
        $gte: new Date(date.getFullYear(), date.getMonth(), 1),
        $lte: new Date(date.getFullYear(), date.getMonth() + 1, 0),
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate('studentId', 'name mobile seatNo')
      .populate('collectedBy', 'name')
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate totals
    const totals = await Payment.aggregate([
      { $match: { libraryId: libraryId, status: 'paid', ...query } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
        summary: totals[0] || { totalAmount: 0, count: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/payments
const collectPayment = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { studentId, amount, paymentType, paymentMode, paymentMonth, forMonth, notes, transactionId } = req.body;

    const student = await Student.findOne({ _id: studentId, libraryId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const payment = await Payment.create({
      libraryId,
      studentId,
      studentName: student.name,
      seatNo: student.seatNo,
      amount,
      paymentType: paymentType || 'monthly_fee',
      paymentMode: paymentMode || 'cash',
      paymentMonth,
      forMonth: forMonth ? new Date(forMonth) : new Date(),
      status: 'paid',
      notes,
      transactionId,
      collectedBy: req.user._id,
      paidAt: new Date(),
    });

    // Update library revenue
    await Library.findByIdAndUpdate(libraryId, { $inc: { totalRevenue: amount } });

    res.status(201).json({ success: true, message: 'Payment recorded successfully.', data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/payments/dashboard-summary
const getPaymentSummary = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [monthlyRevenue, totalRevenue, paymentModes] = await Promise.all([
      Payment.aggregate([
        { $match: { libraryId, status: 'paid', paidAt: { $gte: firstDay, $lte: lastDay } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { libraryId, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { libraryId, status: 'paid', paidAt: { $gte: firstDay, $lte: lastDay } } },
        { $group: { _id: '$paymentMode', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        thisMonth: monthlyRevenue[0] || { total: 0, count: 0 },
        allTime: totalRevenue[0] || { total: 0 },
        byPaymentMode: paymentModes,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllPayments, collectPayment, getPaymentSummary };
