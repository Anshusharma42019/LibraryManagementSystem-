require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Plan = require('../models/Plan');
const User = require('../models/User');

const seedData = async () => {
  await connectDB();

  console.log('🌱 Starting seeder...');

  // Seed Plans
  await Plan.deleteMany();
  const plans = await Plan.insertMany([
    {
      name: 'Starter',
      price: 499,
      maxSeats: 50,
      maxStaff: 1,
      displayOrder: 1,
      description: 'Perfect for small reading rooms',
      features: {
        whatsappNotifications: false,
        smsNotifications: false,
        customDomain: false,
        qrIdCards: true,
        receiptPrinting: true,
        expenseTracking: false,
        advancedReports: false,
        multipleStaff: false,
      },
    },
    {
      name: 'Basic',
      price: 799,
      maxSeats: 100,
      maxStaff: 2,
      displayOrder: 2,
      description: 'For growing libraries',
      tag: 'Popular',
      features: {
        whatsappNotifications: true,
        smsNotifications: false,
        customDomain: false,
        qrIdCards: true,
        receiptPrinting: true,
        expenseTracking: true,
        advancedReports: false,
        multipleStaff: true,
      },
    },
    {
      name: 'Professional',
      price: 1499,
      maxSeats: 300,
      maxStaff: 5,
      displayOrder: 3,
      description: 'For professional library centers',
      tag: 'Best Value',
      features: {
        whatsappNotifications: true,
        smsNotifications: true,
        customDomain: false,
        qrIdCards: true,
        receiptPrinting: true,
        expenseTracking: true,
        advancedReports: true,
        multipleStaff: true,
        apiAccess: false,
        prioritySupport: true,
        autoBackup: true,
      },
    },
    {
      name: 'Enterprise',
      price: 0,
      maxSeats: 999999,
      maxStaff: 999,
      displayOrder: 4,
      description: 'Custom pricing for large chains',
      features: {
        whatsappNotifications: true,
        smsNotifications: true,
        customDomain: true,
        qrIdCards: true,
        receiptPrinting: true,
        expenseTracking: true,
        advancedReports: true,
        multipleStaff: true,
        apiAccess: true,
        prioritySupport: true,
        autoBackup: true,
      },
    },
  ]);
  console.log(`✅ ${plans.length} Plans seeded.`);

  // Seed Super Admin
  const existingAdmin = await User.findOne({ role: 'superadmin' });
  if (!existingAdmin) {
    await User.create({
      name: 'Super Admin',
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@librarysaas.com',
      password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456',
      role: 'superadmin',
      isActive: true,
    });
    console.log(`✅ Super Admin created: ${process.env.SUPER_ADMIN_EMAIL}`);
  } else {
    console.log('ℹ️  Super Admin already exists, skipping.');
  }

  console.log('🎉 Seeding complete!');
  process.exit(0);
};

seedData().catch((err) => {
  console.error('❌ Seeder error:', err);
  process.exit(1);
});
