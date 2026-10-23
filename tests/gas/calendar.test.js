const assert = require('assert');
const { createContext } = require('./gas-mock');
const ctx = createContext({ dir: process.argv[2] || require('path').join(__dirname, '../../gas'), ownerEmail: 'owner@gmail.com' });
const G = ctx.__get;
G('setup')();
const calId = G('getSetting_')('CALENDAR_ID');
assert.ok(calId, 'calendar created by setup');
const cal = ctx._calendars.get(calId);
G('setup')();
assert.strictEqual(ctx._calendars.size, 1, 'setup reuses calendar');

const K = 'kid@gmail.com', O = 'owner@gmail.com';
G('appendRows_')(G('readTable_')('members'), [{ email: K, name: 'Kid', enabled: true, remindDays: 3, calendarEnabled: true, emailEnabled: true }]);

const v = G('svcSaveVehicle_')(K, { name: 'Moto', plate: 'K-1', type: 'moto', year: 2024, currentMileage: 1000 }).vehicle;
const it = G('svcSaveItem_')(K, { vehicleId: v.id, name: '機油', intervalKm: 1000, intervalMonths: 3, lastKm: 900, lastDate: '2026-09-01' }).item;
assert.strictEqual(cal.events.size, 1, 'event created on item save');
let ev = [...cal.events.values()][0];
assert.strictEqual(ev.guests, K, 'kid invited');
assert.strictEqual(ev.sendInvites, true);
assert.ok(ev.title.includes('Moto') && ev.title.includes('機油'));
assert.deepStrictEqual(ev.reminders, [3 * 1440 - 540, 1440 - 540]);
const itemRow = () => G('readTable_')('items').rows.find(r => r.id === it.id);
assert.strictEqual(itemRow().calendarEventId, ev.id);
assert.strictEqual(it.calendarEventId, undefined, 'event id not exposed to client');

// record maintenance -> due date changes -> same event updated
G('svcSaveRecord_')(K, { vehicleId: v.id, date: '2026-10-10', mileage: 1300, type: 'maintenance', title: 'x', amount: 1, details: { itemIds: [it.id] } });
assert.strictEqual(cal.events.size, 1, 'no duplicate event');
assert.strictEqual(G('formatDate_')(ev.date), itemRow().dueDate);

// rename item / vehicle updates title
G('svcSaveItem_')(K, { id: it.id, name: '機油（全合成）' });
assert.ok(ev.title.includes('全合成'), 'item title updated');
G('svcSaveVehicle_')(K, { id: v.id, name: 'New Moto' });
assert.ok(ev.title.includes('New Moto'), 'vehicle title updated');

// event deleted manually in calendar -> recreated on next change
cal.events.delete(ev.id);
G('svcSaveItem_')(K, { id: it.id, notes: 'n' });
assert.strictEqual(cal.events.size, 1, 'recreated');
ev = [...cal.events.values()][0];
assert.strictEqual(itemRow().calendarEventId, ev.id);

// owner's own item: no invite
const ov = G('svcSaveVehicle_')(O, { name: 'Car', plate: 'O-1', type: 'car', currentMileage: 10 }).vehicle;
G('svcSaveItem_')(O, { vehicleId: ov.id, name: '機油', intervalKm: 5000, intervalMonths: 6, lastKm: 0, lastDate: '2026-10-01' });
const oev = [...cal.events.values()].find(e => e.title.includes('Car'));
assert.strictEqual(oev.guests, '');
assert.strictEqual(oev.sendInvites, false);

// disable calendar for kid -> daily sync removes event; re-enable recreates
const m = G('readTable_')('members');
G('updateRow_')(m, m.rows.find(r => r.email === K)._row, { calendarEnabled: false });
G('syncAllCalendars_')();
assert.ok(![...cal.events.values()].some(e => e.guests === K), 'kid event removed');
assert.strictEqual(itemRow().calendarEventId, '');
G('updateRow_')(m, m.rows.find(r => r.email === K)._row, { calendarEnabled: true });
G('syncAllCalendars_')();
assert.ok([...cal.events.values()].some(e => e.guests === K), 'kid event recreated');

// delete item removes event
G('svcDeleteItem_')(K, it.id);
assert.ok(![...cal.events.values()].some(e => e.guests === K));

// delete vehicle removes its events
G('svcSaveItem_')(K, { vehicleId: v.id, name: 'A', intervalKm: 100, intervalMonths: 1, lastKm: 0, lastDate: '2026-10-01' });
assert.ok([...cal.events.values()].some(e => e.guests === K));
G('svcDeleteVehicle_')(K, v.id);
assert.ok(![...cal.events.values()].some(e => e.guests === K));

// import skips calendar; daily sync creates later
const before = cal.events.size;
G('svcImportAll_')(K, { vehicles: [{ id: 'v1', name: 'I', plate: 'I', type: 'car', currentMileage: 0 }], maintenanceItems: [{ id: 'm1', vehicleId: 'v1', name: 'm', intervalKm: 100, intervalMonths: 1, lastKm: 0, lastDate: '2026-10-01' }], records: [] });
assert.strictEqual(cal.events.size, before, 'import does not create events');
G('syncAllCalendars_')();
assert.strictEqual(cal.events.size, before + 1, 'daily sync creates');

// calendar failure does not break save
const realGet = ctx.CalendarApp.getCalendarById;
ctx.CalendarApp.getCalendarById = () => { throw new Error('calendar down'); };
const ok = G('svcSaveItem_')(O, { vehicleId: ov.id, name: 'B', intervalKm: 100, intervalMonths: 1, lastKm: 0, lastDate: '2026-10-01' });
assert.ok(ok.item.id, 'save succeeds despite calendar error');
ctx.CalendarApp.getCalendarById = realGet;
console.log('calendar tests passed');
