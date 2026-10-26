// Tests for gas Data/Service/Setup under mock
const assert = require('assert');
const { createContext } = require('./gas-mock');
const dir = process.argv[2] || require('path').join(__dirname, '../../gas');

const ctx = createContext({ dir });
const G = ctx.__get;
G('setup')();
G('setup')(); // idempotent

const sheetNames = ctx._sheets.map(s => s.name);
assert.deepStrictEqual(sheetNames.sort(), ['成員', '紀錄', '設定', '車輛', '保養項目'].sort());
const members = G('readTable_')('members').rows;
assert.strictEqual(members.length, 1, 'owner added once');
assert.strictEqual(members[0].enabled, true);

const A = 'a@gmail.com', B = 'b@gmail.com';
const v = G('svcSaveVehicle_')(A, { name: 'DRG', plate: 'MBQ-1', type: 'moto', year: 2023, currentMileage: 1000, notes: '' }).vehicle;
assert.ok(v.id.startsWith('v_'));
assert.strictEqual(v.owner, undefined);
const vB = G('svcSaveVehicle_')(B, { name: 'B car', plate: 'B-1', type: 'car', year: 2020, currentMileage: 50, notes: '' }).vehicle;

const item = G('svcSaveItem_')(A, { vehicleId: v.id, name: '機油', intervalKm: 1000, intervalMonths: 3, lastKm: 900, lastDate: '2026-09-01', notes: '' }).item;
assert.throws(() => G('svcSaveItem_')(B, { vehicleId: v.id, name: 'x' }), /NOT_FOUND|權限/);

const res = G('svcSaveRecord_')(A, { vehicleId: v.id, date: '2026-10-01', mileage: 1200, type: 'maintenance', title: '換機油', amount: 300, vendor: '店', notes: '', details: { itemIds: [item.id] } });
assert.strictEqual(res.vehicle.currentMileage, 1200);
assert.strictEqual(res.items[0].lastKm, 1200);
assert.strictEqual(res.items[0].lastDate, '2026-10-01');
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(res.items[0].dueDate), 'dueDate computed: ' + res.items[0].dueDate);
G('svcSaveRecord_')(A, { vehicleId: v.id, date: '2026-10-05', mileage: 1300, type: 'fuel', title: '加油', amount: 190, vendor: '', notes: '', details: { liters: 6, pricePerLiter: 31.5, isFullTank: true } });

// B cannot see / edit A's data
const bootB = G('svcBootstrap_')(B);
assert.strictEqual(bootB.vehicles.length, 1);
assert.strictEqual(bootB.records.length, 0);
assert.throws(() => G('svcDeleteVehicle_')(B, v.id), /權限/);
assert.throws(() => G('svcSaveRecord_')(B, { id: res.record.id, title: 'hack' }), /權限/);

const bootA = G('svcBootstrap_')(A);
assert.strictEqual(bootA.vehicles.length, 1);
assert.strictEqual(bootA.records.length, 2);
const fuel = bootA.records.find(r => r.type === 'fuel');
assert.deepStrictEqual(JSON.parse(JSON.stringify(fuel.details)), { liters: 6, pricePerLiter: 31.5, isFullTank: true });
const maint = bootA.records.find(r => r.type === 'maintenance');
assert.deepStrictEqual(JSON.parse(JSON.stringify(maint.details)), { itemIds: [item.id], parts: [] });

// 保養項目明細存成 JSON，空名稱的列會被略過
G('svcSaveRecord_')(A, { ...maint, details: { itemIds: [item.id], parts: [{ name: '機油', spec: '10W40', price: '250' }, { name: ' ', price: 1 }] } });
assert.deepStrictEqual(JSON.parse(JSON.stringify(G('svcBootstrap_')(A).records.find(r => r.id === maint.id).details.parts)), [{ name: '機油', spec: '10W40', price: 250 }]);

// edit record
G('svcSaveRecord_')(A, { ...maint, title: '換機油2' });
assert.strictEqual(G('svcBootstrap_')(A).records.find(r => r.id === maint.id).title, '換機油2');

// sheet stores Chinese enum labels
const vehSheet = ctx._sheets.find(s => s.name === '車輛');
assert.ok(vehSheet.data.some(r => r.includes('機車')));

// delete vehicle cascades
G('svcDeleteVehicle_')(A, v.id);
const after = G('svcBootstrap_')(A);
assert.strictEqual(after.vehicles.length + after.records.length + after.maintenanceItems.length, 0);
assert.strictEqual(G('svcBootstrap_')(B).vehicles.length, 1, 'B untouched');

// import
const local = {
  vehicles: [{ id: 'v1', name: 'L1', plate: 'P', type: 'moto', year: 2023, currentMileage: 100, initialMileage: 0, notes: '' }],
  maintenanceItems: [{ id: 'm1', vehicleId: 'v1', name: '機油', intervalKm: 1000, intervalMonths: 3, lastKm: 0, lastDate: '2026-01-01', notes: '' }],
  records: [{ id: 'r1', vehicleId: 'v1', date: '2026-01-01', mileage: 0, type: 'maintenance', title: 't', amount: 1, vendor: '', notes: '', details: { itemIds: ['m1'] } }]
};
const imp = G('svcImportAll_')(A, local);
assert.deepStrictEqual(JSON.parse(JSON.stringify(imp)), { vehicles: 1, maintenanceItems: 1, records: 1 });
const bootImp = G('svcBootstrap_')(A);
assert.strictEqual(bootImp.records[0].details.itemIds[0], bootImp.maintenanceItems[0].id, 'itemIds remapped');
assert.strictEqual(bootImp.records[0].vehicleId, bootImp.vehicles[0].id);
G('svcImportAll_')(A, local); // re-import replaces
assert.strictEqual(G('svcBootstrap_')(A).vehicles.length, 1);
assert.strictEqual(G('svcBootstrap_')(B).vehicles.length, 1, 'B untouched by import');

// checkbox rows: appended rows land right after data even if checkboxes pre-filled to row 1000
const recTable = G('readTable_')('records');
assert.ok(recTable.lastDataRow < 20, 'records appended near top, got ' + recTable.lastDataRow);
assert.strictEqual(recTable.rows.length, recTable.lastDataRow - 1, 'no gaps');

console.log('data/service tests passed');
module.exports = { ctx };

// client-supplied ids
{
  const C = 'c@gmail.com';
  const cv = G('svcSaveVehicle_')(C, { id: 'v_abc123def456', name: 'C', plate: 'C', type: 'car', year: 2020, currentMileage: 10 }).vehicle;
  assert.strictEqual(cv.id, 'v_abc123def456', 'client id kept');
  const bad = G('svcSaveVehicle_')(C, { id: 'v1', name: 'bad id', plate: 'C', type: 'car', currentMileage: 1 }).vehicle;
  assert.notStrictEqual(bad.id, 'v1', 'invalid client id replaced');
  // another owner cannot hijack an existing id
  assert.throws(() => G('svcSaveVehicle_')(A, { id: 'v_abc123def456', name: 'hijack' }), /權限/);
  const ci = G('svcSaveItem_')(C, { id: 'item_zzzzzzzz', vehicleId: cv.id, name: 'x', intervalKm: 100, intervalMonths: 1, lastKm: 0, lastDate: '2026-10-01' }).item;
  assert.strictEqual(ci.id, 'item_zzzzzzzz');
  const cr = G('svcSaveRecord_')(C, { id: 'rec_yyyyyyyy', vehicleId: cv.id, date: '2026-10-02', mileage: 20, type: 'other', title: 't', amount: 1, details: {} });
  assert.strictEqual(cr.record.id, 'rec_yyyyyyyy');
  // same id again = update
  G('svcSaveRecord_')(C, { id: 'rec_yyyyyyyy', vehicleId: cv.id, date: '2026-10-02', mileage: 20, type: 'other', title: 't2', amount: 1, details: {} });
  const recs = G('svcBootstrap_')(C).records;
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].title, 't2');
  console.log('client id tests passed');
}

// append import keeps existing data
{
  const D = 'd@gmail.com';
  G('svcSaveVehicle_')(D, { name: 'existing', plate: 'E', type: 'car', currentMileage: 1 });
  G('svcImportAll_')(D, local, true);
  assert.strictEqual(G('svcBootstrap_')(D).vehicles.length, 2, 'append keeps existing');
  G('svcImportAll_')(D, local, false);
  assert.strictEqual(G('svcBootstrap_')(D).vehicles.length, 1, 'replace removes existing');
  console.log('append import tests passed');
}

// 舊試算表缺少新欄位時自動補上標題
{
  const ctx2 = createContext({ dir });
  ctx2.__get('setup')();
  const sheet = ctx2._sheets.find(s => s.name === '紀錄');
  const col = sheet.data[0].indexOf('項目明細');
  sheet.data.forEach(row => row.splice(col, 1));
  assert.strictEqual(sheet.data[0].indexOf('項目明細'), -1);
  ctx2.__get('readTable_')('records');
  assert.notStrictEqual(sheet.data[0].indexOf('項目明細'), -1, 'header re-added');
  console.log('auto column tests passed');
}
