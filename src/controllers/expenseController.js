const Expense = require('../models/Expense');

const getLibraryId = (req) =>
  req.user.role === 'superadmin' ? req.query.libraryId || req.body.libraryId : req.user.libraryId;

// @GET /api/expenses
const getAllExpenses = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { category, month, year, page = 1, limit = 50 } = req.query;

    const query = { libraryId };
    if (category) query.category = category;

    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      query.date = { $gte: start, $lte: end };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .populate('addedBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: expenses,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/expenses
const createExpense = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const expense = await Expense.create({ ...req.body, libraryId, addedBy: req.user._id });
    res.status(201).json({ success: true, message: 'Expense added.', data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/expenses/:id
const updateExpense = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const allowed = ['title', 'amount', 'category', 'date', 'notes', 'paymentMode'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, libraryId },
      updates,
      { new: true }
    );
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
    res.status(200).json({ success: true, message: 'Expense updated.', data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, libraryId });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
    res.status(200).json({ success: true, message: 'Expense deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/expenses/summary
const getExpenseSummary = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [thisMonth, byCategory, allTime] = await Promise.all([
      Expense.aggregate([
        { $match: { libraryId, date: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { libraryId, date: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Expense.aggregate([
        { $match: { libraryId } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        thisMonth: thisMonth[0] || { total: 0, count: 0 },
        byCategory,
        allTime: allTime[0] || { total: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary };
