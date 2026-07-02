require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/auth');
const superadminRoutes = require('./routes/superadmin');
const studentRoutes = require('./routes/students');
const paymentRoutes = require('./routes/payments');
const seatRoutes = require('./routes/seats');
const attendanceRoutes = require('./routes/attendance');
const expenseRoutes = require('./routes/expenses');
const staffRoutes = require('./routes/staff');
const dashboardRoutes = require('./routes/dashboard');
const studentPortalRoutes = require('./routes/studentPortal');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : []
).concat(['http://localhost:3000', 'http://localhost:5000']);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

// Connect Database
connectDB();

// CORS must be first — before all other middleware so headers are always sent
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Security Middleware
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 1000,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Library SaaS API is running.' });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/library', dashboardRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/student-portal', studentPortalRoutes);

// Root Route
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Library SaaS API is running. Visit /health for status or /api/* for endpoints.' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// Global Error Handler — manually set CORS header as safety net
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  socket.on('join-library', (libraryId) => {
    socket.join(`library-${libraryId}`);
  });
  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`🏥 Health: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

module.exports = { app, io };
