const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Library = require('../models/Library');

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  });
  return { accessToken, refreshToken };
};

// @POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password +refreshToken');
    // Always compare to prevent timing attacks
    const dummyHash = '$2a$12$dummyhashfordummycomparison000000000000000000000000000';
    const isMatch = user ? await user.comparePassword(password) : await bcrypt.compare(password, dummyHash);

    if (!user || !isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Fetch library info if not superadmin
    let libraryInfo = null;
    if (user.role !== 'superadmin' && user.libraryId) {
      libraryInfo = await Library.findById(user.libraryId).select(
        'name status planName subscriptionExpiry settings logo'
      );
    }

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          libraryId: user.libraryId,
          permissions: user.permissions,
          avatar: user.avatar,
        },
        library: libraryInfo,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/auth/refresh
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};

// @POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let library = null;
    if (user.role !== 'superadmin' && user.libraryId) {
      library = await Library.findById(user.libraryId).select(
        'name status planName subscriptionExpiry settings logo totalSeatsAllowed'
      );
    }
    res.status(200).json({ success: true, data: { user, library } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/auth/register/superadmin
const registerSuperAdmin = async (req, res) => {
  try {
    const { name, email, mobile, password, secretKey } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    // Secret key check - only someone who knows this key can create superadmin
    if (secretKey !== process.env.SUPER_ADMIN_SECRET_KEY) {
      return res.status(403).json({ success: false, message: 'Invalid secret key.' });
    }

    // Check if superadmin already exists
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperAdmin) {
      return res.status(400).json({ success: false, message: 'Super Admin already exists.' });
    }

    // Check if email already taken
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    // Create superadmin
    const superAdmin = await User.create({
      name,
      email,
      mobile,
      password,
      role: 'superadmin',
      isActive: true,
    });

    const { accessToken, refreshToken: rToken } = generateTokens(superAdmin._id);

    superAdmin.refreshToken = rToken;
    superAdmin.lastLogin = new Date();
    await superAdmin.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message: 'Super Admin registered successfully.',
      data: {
        user: {
          _id: superAdmin._id,
          name: superAdmin.name,
          email: superAdmin.email,
          role: superAdmin.role,
          mobile: superAdmin.mobile,
        },
        accessToken,
        refreshToken: rToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login, refreshToken, logout, getMe, changePassword, registerSuperAdmin };
