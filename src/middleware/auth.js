const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Library = require('../models/Library');

// Verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshToken');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    }

    req.user = user;

    // If owner or staff, attach library and verify active
    if (user.role !== 'superadmin' && user.libraryId) {
      const library = await Library.findById(user.libraryId);

      if (!library) {
        return res.status(404).json({ success: false, message: 'Library not found.' });
      }

      if (library.status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Your library is suspended. Please contact support.',
        });
      }

      req.library = library;
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    res.status(500).json({ success: false, message: 'Server error in auth middleware.' });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' cannot perform this action.`,
      });
    }
    next();
  };
};

// CRITICAL: Tenant Isolation
// Injects libraryId as ObjectId so all queries stay within the tenant
const tenantIsolation = (req, res, next) => {
  if (req.user.role === 'superadmin') {
    // SuperAdmin can pass libraryId via query or body for cross-tenant access
    const lid = req.query.libraryId || req.body.libraryId;
    if (lid && mongoose.Types.ObjectId.isValid(lid)) {
      req.tenantId = new mongoose.Types.ObjectId(lid);
    }
    return next();
  }

  if (!req.user.libraryId) {
    return res.status(403).json({
      success: false,
      message: 'No library associated with this account.',
    });
  }

  req.tenantId = req.user.libraryId;
  next();
};

// Staff permission check
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (req.user.role === 'superadmin' || req.user.role === 'owner') {
      return next();
    }

    if (req.user.role === 'staff' && req.user.permissions && req.user.permissions[permission]) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Permission denied. You need '${permission}' permission.`,
    });
  };
};

module.exports = { protect, authorize, tenantIsolation, checkPermission };
