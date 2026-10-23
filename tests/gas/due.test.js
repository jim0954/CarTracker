const assert = require('assert');
const { createContext } = require('./gas-mock');
const ctx = createContext({ dir: process.argv[2] || require('path').join(__dirname, '../../gas') });
const G = ctx.__get;
const parse = G('parseDate_'), fmt = G('formatDate_'), due = G('computeDueDate_'), rate = G('avgDailyKm_'), addM = G('addMonths_');

assert.strictEqual(fmt(addM(parse('2026-01-31'), 1)), '2026-02-28');
assert.strictEqual(fmt(addM(parse('2026-10-15'), 3)), '2027-01-15');

const today = parse('2026-10-23');
const vehicle = { currentMileage: 12850 };
// 30 km/day over the window
const recs = [{ date: '2026-09-23', mileage: 11950 }, { date: '2026-10-23', mileage: 12850 }];
const r = rate(vehicle, recs, today);
assert.ok(Math.abs(r - 30) < 0.01, 'rate ' + r);

// km-based earlier: remaining 150km / 30 = 5 days
assert.strictEqual(due({ lastKm: 12000, intervalKm: 1000, lastDate: '2026-09-15', intervalMonths: 3 }, vehicle, r, today), '2026-10-28');
// month-based earlier
assert.strictEqual(due({ lastKm: 12000, intervalKm: 100000, lastDate: '2026-09-15', intervalMonths: 1 }, vehicle, r, today), '2026-10-15');
// overdue km -> past date (base - 1850/30 days)
assert.strictEqual(due({ lastKm: 10000, intervalKm: 1000, lastDate: '2026-10-01', intervalMonths: 12 }, vehicle, r, today), '2026-08-23');
// base date = last mileage point, not today
assert.strictEqual(G('formatDate_')(G('lastMileageDate_')(vehicle, recs, parse('2026-12-01'))), '2026-10-23');
// no rate -> month only
assert.strictEqual(due({ lastKm: 0, intervalKm: 1000, lastDate: '2026-10-01', intervalMonths: 6 }, vehicle, null, today), '2027-04-01');
// nothing -> ''
assert.strictEqual(due({ lastKm: 0, intervalKm: 0, lastDate: '', intervalMonths: 0 }, vehicle, null, today), '');
// not enough span -> null; falls back to older records
assert.strictEqual(rate(vehicle, [{ date: '2026-10-20', mileage: 12800 }, { date: '2026-10-23', mileage: 12850 }], today), null);
const fallback = rate(vehicle, [{ date: '2025-01-01', mileage: 1000 }, { date: '2025-01-11', mileage: 1500 }, { date: '2026-10-22', mileage: 12850 }], today);
assert.ok(fallback > 0, 'fallback to all records');
console.log('due date tests passed');
