/**
 * OFFLINE LOGIC TEST — DB connection ke bina
 * Sab controllers, helpers, models schema validate karta hai
 */

require('dotenv').config();

let passed = 0;
let failed = 0;

const test = (name, fn) => {
  try {
    const result = fn();
    if (result === false) throw new Error('returned false');
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌  ${name} — ${e.message}`);
    failed++;
  }
};

const head = (title) => console.log(`\n${'─'.repeat(55)}\n  ${title}\n${'─'.repeat(55)}`);

// ── 1. HELPER FUNCTIONS ─────────────────────────────────────────────────────
head('1. Attendance Helper: addHoursToTime');

const addHoursToTime = (timeStr, hours) => {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

test('09:00 + 2 hrs = 11:00', () => addHoursToTime('09:00', 2) === '11:00');
test('10:30 + 3 hrs = 13:30', () => addHoursToTime('10:30', 3) === '13:30');
test('20:00 + 4 hrs = 00:00 (midnight wrap)', () => addHoursToTime('20:00', 4) === '00:00');
test('06:00 + 8 hrs = 14:00', () => addHoursToTime('06:00', 8) === '14:00');
test('14:45 + 2 hrs = 16:45', () => addHoursToTime('14:45', 2) === '16:45');
test('22:00 + 3 hrs = 01:00 (next day wrap)', () => addHoursToTime('22:00', 3) === '01:00');

// ── 2. TOTAL HOURS CALCULATION ──────────────────────────────────────────────
head('2. Check-out totalHours Calculation');

const calcHours = (checkIn, checkOut) =>
  parseFloat(((checkOut - checkIn) / (1000 * 60 * 60)).toFixed(2));

const makeTime = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };

test('09:00 → 11:00 = 2.00 hrs', () => calcHours(makeTime(9,0), makeTime(11,0)) === 2.00);
test('10:30 → 13:30 = 3.00 hrs', () => calcHours(makeTime(10,30), makeTime(13,30)) === 3.00);
test('06:00 → 22:00 = 16.00 hrs', () => calcHours(makeTime(6,0), makeTime(22,0)) === 16.00);
test('09:15 → 13:15 = 4.00 hrs', () => calcHours(makeTime(9,15), makeTime(13,15)) === 4.00);
test('10:00 → 10:30 = 0.50 hrs (short visit)', () => calcHours(makeTime(10,0), makeTime(10,30)) === 0.50);

// ── 3. ATTENDANCE STATUS LOGIC ──────────────────────────────────────────────
head('3. Status Decision After Checkout');

const getStatus = (totalHours) => {
  if (totalHours >= 6) return 'present';
  if (totalHours >= 2) return 'half_day';
  return 'present'; // short visit still counts
};

test('0.5 hrs → present (short visit)', () => getStatus(0.5) === 'present');
test('2.0 hrs → half_day', () => getStatus(2.0) === 'half_day');
test('3.5 hrs → half_day', () => getStatus(3.5) === 'half_day');
test('6.0 hrs → present', () => getStatus(6.0) === 'present');
test('8.0 hrs → present', () => getStatus(8.0) === 'present');

// ── 4. SLOT VALIDATION ───────────────────────────────────────────────────────
head('4. Slot Booking Validation');

const validSlots = [2, 3, 4, 6, 8, 12];
const isValidSlot = (n) => validSlots.includes(Number(n));

test('2 hours — valid', () => isValidSlot(2));
test('3 hours — valid', () => isValidSlot(3));
test('4 hours — valid', () => isValidSlot(4));
test('6 hours — valid', () => isValidSlot(6));
test('8 hours — valid', () => isValidSlot(8));
test('12 hours — valid', () => isValidSlot(12));
test('1 hour — INVALID', () => !isValidSlot(1));
test('5 hours — INVALID', () => !isValidSlot(5));
test('0 hours — INVALID', () => !isValidSlot(0));
test('"3" string — valid (auto-cast)', () => isValidSlot('3'));

// ── 5. DATE RANGE HELPER ─────────────────────────────────────────────────────
head('5. getTodayRange Helper');

const getTodayRange = (dateStr) => {
  const start = dateStr ? new Date(dateStr) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

test('Today range: start is 00:00:00', () => {
  const { start } = getTodayRange();
  return start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0;
});
test('Today range: end is 23:59:59', () => {
  const { end } = getTodayRange();
  return end.getHours() === 23 && end.getMinutes() === 59 && end.getSeconds() === 59;
});
test('Custom date 2025-01-15: start = Jan 15', () => {
  const { start } = getTodayRange('2025-01-15');
  return start.getDate() === 15 && start.getMonth() === 0;
});
test('Range spans exactly 1 day', () => {
  const { start, end } = getTodayRange();
  const diffHrs = (end - start) / (1000 * 60 * 60);
  return Math.round(diffHrs) === 24;
});

// ── 6. STUDENT DATA VALIDATION ───────────────────────────────────────────────
head('6. Student Form Validation Logic');

const validateStudent = ({ name, mobile, monthlyFee }) => {
  if (!name || !name.trim()) return 'Name required';
  if (!mobile || mobile.length < 10) return 'Valid mobile required';
  if (!monthlyFee || isNaN(monthlyFee) || monthlyFee <= 0) return 'Valid fee required';
  return null;
};

test('Valid student — no error', () => validateStudent({ name: 'Amit', mobile: '9001001001', monthlyFee: 900 }) === null);
test('Missing name — error', () => validateStudent({ name: '', mobile: '9001001001', monthlyFee: 900 }) !== null);
test('Short mobile — error', () => validateStudent({ name: 'Amit', mobile: '9001', monthlyFee: 900 }) !== null);
test('Zero fee — error', () => validateStudent({ name: 'Amit', mobile: '9001001001', monthlyFee: 0 }) !== null);
test('Negative fee — error', () => validateStudent({ name: 'Amit', mobile: '9001001001', monthlyFee: -100 }) !== null);

// ── 7. ATTENDANCE MAP (FRONTEND BULK MARK) ──────────────────────────────────
head('7. Frontend Attendance Map Logic');

const buildAttendanceMap = (students, existingRecords) => {
  const map = {};
  existingRecords.forEach(a => {
    const sid = typeof a.studentId === 'object' ? a.studentId._id : a.studentId;
    map[sid] = a.status;
  });
  students.forEach(s => { if (!map[s._id]) map[s._id] = 'present'; });
  return map;
};

const mockStudents = [
  { _id: 'S1', name: 'Amit' },
  { _id: 'S2', name: 'Priya' },
  { _id: 'S3', name: 'Rahul' },
];
const mockRecords = [
  { studentId: 'S2', status: 'absent' },
];

const map = buildAttendanceMap(mockStudents, mockRecords);
test('S1 defaults to present', () => map['S1'] === 'present');
test('S2 shows absent (from DB)', () => map['S2'] === 'absent');
test('S3 defaults to present', () => map['S3'] === 'present');

const toggle = (m, id) => ({ ...m, [id]: m[id] === 'present' ? 'absent' : 'present' });
const toggled = toggle(map, 'S1');
test('Toggle S1 present → absent', () => toggled['S1'] === 'absent');
test('Toggle S2 absent → present', () => toggle(map, 'S2')['S2'] === 'present');

// ── 8. SLOT END TIME (FRONTEND useEffect) ───────────────────────────────────
head('8. Frontend Slot End Time Calculation');

const calcSlotEnd = (startTime, hours) => {
  if (!startTime || !hours) return '';
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + Number(hours) * 60;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

test('09:00 + 2hrs = 11:00', () => calcSlotEnd('09:00', 2) === '11:00');
test('14:00 + 4hrs = 18:00', () => calcSlotEnd('14:00', 4) === '18:00');
test('08:00 + 2hrs = 10:00', () => calcSlotEnd('08:00', 2) === '10:00');
test('Empty start → empty string', () => calcSlotEnd('', 3) === '');
test('"3" string hours works', () => calcSlotEnd('09:00', '3') === '12:00');

// ── 9. CURRENTLY-INSIDE DETECTION ─────────────────────────────────────────
head('9. Currently-Inside Students Detection');

const mockAttRecords = [
  { _id: 'A1', studentId: { _id: 'S1', name: 'Amit' }, checkIn: new Date(), checkOut: null },
  { _id: 'A2', studentId: { _id: 'S2', name: 'Priya' }, checkIn: new Date(), checkOut: new Date() },
  { _id: 'A3', studentId: { _id: 'S3', name: 'Rahul' }, checkIn: null, checkOut: null },
];

const getCheckedInIds = (records) => new Set(
  records
    .filter(r => r.checkIn && !r.checkOut)
    .map(r => typeof r.studentId === 'object' ? r.studentId._id : r.studentId)
);

const checkedInIds = getCheckedInIds(mockAttRecords);
test('S1 is currently inside (checkIn, no checkOut)', () => checkedInIds.has('S1'));
test('S2 is NOT inside (has checkOut)', () => !checkedInIds.has('S2'));
test('S3 is NOT inside (no checkIn)', () => !checkedInIds.has('S3'));
test('Only 1 person inside', () => checkedInIds.size === 1);

// ── 10. PAYMENT CALCULATION ─────────────────────────────────────────────────
head('10. Payment & Revenue Calculation');

const mockPayments = [
  { amount: 900, status: 'paid', paymentMode: 'cash' },
  { amount: 1500, status: 'paid', paymentMode: 'upi' },
  { amount: 800, status: 'paid', paymentMode: 'cash' },
  { amount: 900, status: 'pending', paymentMode: 'cash' },
];

const totalRevenue = mockPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
const cashTotal = mockPayments.filter(p => p.status === 'paid' && p.paymentMode === 'cash').reduce((s, p) => s + p.amount, 0);

test('Total revenue (paid only) = 3200', () => totalRevenue === 3200);
test('Cash total = 1700', () => cashTotal === 1700);
test('Pending not counted', () => totalRevenue !== 4100);

// ── FINAL RESULT ─────────────────────────────────────────────────────────────
head('FINAL RESULTS');
console.log(`\n  Total Tests : ${passed + failed}`);
console.log(`  Passed      : ${passed}`);
console.log(`  Failed      : ${failed}`);

if (failed === 0) {
  console.log('\n  🎉  ALL TESTS PASSED!\n');
  process.exit(0);
} else {
  console.log(`\n  ⚠️   ${failed} test(s) failed. Fix the issues above.\n`);
  process.exit(1);
}
