# 📚 Library SaaS - Multi-Tenant Backend

## Tech Stack
- **Runtime**: Node.js + Express
- **Database**: MongoDB + Mongoose
- **Auth**: JWT + Refresh Tokens
- **Real-time**: Socket.IO
- **Payments**: Razorpay

## Setup Kaise Karein

### 1. Dependencies Install
```bash
cd backend
npm install
```

### 2. Environment Variables
```bash
cp .env.example .env
# .env file mein apni values fill karein
```

### 3. Database Seed (Plans + Super Admin)
```bash
npm run seed
```

### 4. Server Start
```bash
npm run dev     # Development
npm start       # Production
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login (all roles) |
| POST | /api/auth/refresh | Refresh access token |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/change-password | Change password |

### Super Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/superadmin/dashboard | Dashboard stats |
| GET | /api/superadmin/libraries | All libraries (paginated) |
| POST | /api/superadmin/libraries | Create library + owner |
| PUT | /api/superadmin/libraries/:id | Update library |
| PATCH | /api/superadmin/libraries/:id/status | Suspend/Activate |
| DELETE | /api/superadmin/libraries/:id | Delete library |

### Students (Library Owner/Staff)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/students | All students (tenant-isolated) |
| GET | /api/students/:id | Single student |
| POST | /api/students | Add student |
| PUT | /api/students/:id | Update student |
| DELETE | /api/students/:id | Remove student |
| GET | /api/students/expiring | Expiring soon |
| GET | /api/students/pending-fees | Fee pending |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/payments | All payments |
| POST | /api/payments | Collect fee |
| GET | /api/payments/summary | Dashboard summary |

## Tenant Isolation (IMPORTANT)
Har request mein `libraryId` automatically user ke JWT se inject hoti hai.
Library A kabhi Library B ka data nahi dekh sakti.

```js
// Automatically hota hai via middleware
Student.find({ libraryId: req.user.libraryId });
```

## Default Login
- **Super Admin**: admin@librarysaas.com / Admin@123456
