const User = require('../models/User');

const getLibraryId = (req) =>
  req.user.role === 'superadmin' ? req.query.libraryId || req.body.libraryId : req.user.libraryId;

// @GET /api/staff
const getAllStaff = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const staff = await User.find({ libraryId, role: 'staff' }).select('-password -refreshToken');
    res.status(200).json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/staff
const createStaff = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { name, email, mobile, password, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered.' });

    const staff = await User.create({
      name, email, mobile,
      password: password || 'Staff@123',
      role: 'staff',
      libraryId,
      permissions: permissions || {
        canManageStudents: true,
        canCollectFees: true,
        canManageSeats: false,
        canViewReports: false,
        canManageExpenses: false,
        canManageStaff: false,
      },
    });

    const staffData = staff.toObject();
    delete staffData.password;
    delete staffData.refreshToken;

    res.status(201).json({ success: true, message: 'Staff member added.', data: staffData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/staff/:id
const updateStaff = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const { name, mobile, permissions, isActive } = req.body;

    const staff = await User.findOne({ _id: req.params.id, libraryId, role: 'staff' });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });

    if (name) staff.name = name;
    if (mobile) staff.mobile = mobile;
    if (permissions) staff.permissions = permissions;
    if (typeof isActive === 'boolean') staff.isActive = isActive;

    await staff.save({ validateBeforeSave: false });

    res.status(200).json({ success: true, message: 'Staff updated.', data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/staff/:id
const deleteStaff = async (req, res) => {
  try {
    const libraryId = getLibraryId(req);
    const staff = await User.findOneAndDelete({ _id: req.params.id, libraryId, role: 'staff' });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    res.status(200).json({ success: true, message: 'Staff member removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllStaff, createStaff, updateStaff, deleteStaff };
