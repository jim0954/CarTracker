// 愛車99 轉換測試：node tests/web/iknow99.test.mjs
import assert from 'node:assert';
import { convertIknow99, isIknow99Export } from '../../js/iknow99.js';

const sub = (Name, ValidDistance, LifeTime, extra = {}) => ({ Name, ValidDistance, LifeTime, Qty: 1, UnitPrice: 0, Spec: '', ...extra });
const captures = [
  // 第 1 頁與第 2 頁（沒有重疊，以相同的 Count 合併）
  { url: '/user.method/car_form', data: { Count: { Care: 3, Fuel: 1, Expense: 0 }, Forms: [
    { Id: 4, Type: 2, Date: '2026-03-01 02:00', Odometer: 1200, Amount: 120, Title: 'true,4,30,0,0,0,95無鉛,100' },
    { Id: 3, Type: 1, Date: '2026-02-01 02:00', Odometer: 1100, Amount: 500, Title: '好車行' }
  ] } },
  { url: '/user.method/car_form', data: { Count: { Care: 3, Fuel: 1, Expense: 0 }, Forms: [
    { Id: 2, Type: 1, Date: '2025-12-31 17:00', Odometer: 1000, Amount: 0, Title: '沒點開' },
    { Id: 1, Type: 1, Date: '2020-01-01 16:00', Odometer: 0, Amount: 0, Title: '新車保養週期' }
  ] } },
  { url: '/user.method/car_form', data: { Form: { Id: 1, Type: 1, SubForm: [sub('機油', 1000, 6), sub('電瓶', 0, 36), sub('坐墊', 0, 0)] } } },
  { url: '/user.method/car_form', data: { Form: { Id: 3, Type: 1, SubForm: [sub('機油', 1000, 6, { Spec: '10W40', UnitPrice: 250 }), sub('車牌框', 0, 0)] } } },
  { url: '/user.method/car_property', data: { Components: [
    { ...sub('電瓶', 0, 30), FormId: 1, Odometer: 0, Date: '2020-01-01 16:00' }
  ] } }
];

assert.ok(isIknow99Export(captures));
assert.ok(!isIknow99Export({ vehicles: [] }));

const { data, missingDetails } = convertIknow99(captures);
assert.strictEqual(data.vehicles.length, 1);
assert.strictEqual(missingDetails, 1);

const v = data.vehicles[0];
assert.strictEqual(v.type, 'moto');
assert.strictEqual(v.year, 2020);
assert.strictEqual(v.currentMileage, 1200);

// 兩個週期都是 0 的項目不建立；Components 覆蓋明細推算的週期；UTC 轉台灣日期
const items = Object.fromEntries(data.maintenanceItems.map(it => [it.name, it]));
assert.deepStrictEqual(Object.keys(items).sort(), ['機油', '電瓶']);
assert.strictEqual(items['機油'].lastKm, 1100);
assert.strictEqual(items['機油'].lastDate, '2026-02-01');
assert.strictEqual(items['機油'].notes, '10W40');
assert.strictEqual(items['電瓶'].intervalMonths, 30);
assert.strictEqual(items['電瓶'].lastDate, '2020-01-02');

// 新車保養週期不轉成紀錄
const records = Object.fromEntries(data.records.map(r => [r.title, r]));
assert.strictEqual(data.records.length, 3);
assert.deepStrictEqual(records['機油、車牌框'].details.itemIds, [items['機油'].id]);
assert.strictEqual(records['機油、車牌框'].vendor, '好車行');
assert.strictEqual(records['機油、車牌框'].notes, '機油 10W40 $250；車牌框');
assert.strictEqual(records['沒點開'].date, '2026-01-01');
assert.deepStrictEqual(records['加油 95無鉛'].details, { liters: 4, pricePerLiter: 30, isFullTank: true });

console.log('iknow99 tests passed');
