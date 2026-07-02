const Library = require('../models/Library');
const User = require('../models/User');
const Plan = require('../models/Plan');

// @GET /api/superadmin/libraries
const getAllLibraries = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Library.countDocuments(query);
    const libraries = await Library.find(query)
      .populate('owner', 'name email mobile lastLogin')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        libraries,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/superadmin/libraries
const createLibrary = async (req, res) => {
  try {
    const {
      name, ownerName, email, mobile, address, city, state, pincode,
      gst, planName, subscriptionStart, subscriptionExpiry, customDomain,
      ownerPassword,
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    // Find plan details
    const plan = await Plan.findOne({ name: planName || 'Starter' });

    // Create library owner account
    const owner = await User.create({
      name: ownerName,
      email,
      mobile,
      password: ownerPassword || 'Library@123',
      role: 'owner',
    });

    // Create library
    const library = await Library.create({
      name,
      owner: owner._id,
      ownerName,
      email,
      mobile,
      address,
      city,
      state,
      pincode,
      gst,
      planName: planName || 'Starter',
      plan: plan?._id,
      totalSeatsAllowed: plan?.maxSeats || 50,
      subscriptionStart: subscriptionStart || new Date(),
      subscriptionExpiry: subscriptionExpiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      customDomain,
      status: 'active',
    });

    // Link library to owner
    owner.libraryId = library._id;
    await owner.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message: 'Library created successfully.',
      data: { library, owner: { _id: owner._id, email: owner.email, name: owner.name } },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/superadmin/libraries/:id — whitelist only safe fields
const updateLibrary = async (req, res) => {
  try {
    const allowed = ['name', 'ownerName', 'mobile', 'address', 'city', 'state', 'pincode', 'gst',
      'planName', 'plan', 'totalSeatsAllowed', 'subscriptionStart', 'subscriptionExpiry',
      'customDomain', 'status', 'settings'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const library = await Library.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!library) {
      return res.status(404).json({ success: false, message: 'Library not found.' });
    }
    res.status(200).json({ success: true, message: 'Library updated.', data: library });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PATCH /api/superadmin/libraries/:id/status
const updateLibraryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'suspended', 'expired'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const library = await Library.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!library) {
      return res.status(404).json({ success: false, message: 'Library not found.' });
    }

    const msg = {
      active: 'Library activated successfully.',
      suspended: 'Library suspended.',
      expired: 'Library marked as expired.',
    };

    res.status(200).json({ success: true, message: msg[status], data: library });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/superadmin/libraries/:id
const deleteLibrary = async (req, res) => {
  try {
    const library = await Library.findById(req.params.id);
    if (!library) {
      return res.status(404).json({ success: false, message: 'Library not found.' });
    }
    // Soft delete - just suspend
    library.status = 'suspended';
    await library.save();

    res.status(200).json({ success: true, message: 'Library deleted (suspended) successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/superadmin/dashboard
const getSuperAdminDashboard = async (req, res) => {
  try {
    const [
      totalLibraries,
      activeLibraries,
      expiredLibraries,
      suspendedLibraries,
    ] = await Promise.all([
      Library.countDocuments(),
      Library.countDocuments({ status: 'active' }),
      Library.countDocuments({ status: 'expired' }),
      Library.countDocuments({ status: 'suspended' }),
    ]);

    // Pending renewals (expiring in next 7 days)
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const pendingRenewals = await Library.countDocuments({
      status: 'active',
      subscriptionExpiry: { $gte: now, $lte: sevenDaysLater },
    });

    // Revenue aggregation
    const revenueData = await Library.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$totalRevenue' }, totalStudents: { $sum: '$totalStudents' } } },
    ]);

    const revenue = revenueData[0] || { totalRevenue: 0, totalStudents: 0 };

    // Recent libraries
    const recentLibraries = await Library.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name ownerName status planName createdAt');

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalLibraries,
          activeLibraries,
          expiredLibraries,
          suspendedLibraries,
          pendingRenewals,
          totalStudents: revenue.totalStudents,
          totalRevenue: revenue.totalRevenue,
        },
        recentLibraries,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllLibraries,
  createLibrary,
  updateLibrary,
  updateLibraryStatus,
  deleteLibrary,
  getSuperAdminDashboard,
};
