const assert = require('assert');
const { createContext } = require('./gas-mock');
const ctx = createContext({ dir: process.argv[2] || require('path').join(__dirname, '../../gas'), ownerEmail: 'owner@gmail.com' });
const G = ctx.__get;
G('setup')();
const plain = v => JSON.parse(JSON.stringify(v));
const settings = () => G('readTable_')('settings');
const setDay = d => G('setSetting_')('BACKUP_DAY', String(d));
const parse = G('parseDate_');
const run = d => G('sendQuarterlyBackups_')(parse(d));
const backups = () => ctx._mail.filter(m => m.subject.includes('資料備份'));

assert.ok(settings().rows.some(r => r.key === 'BACKUP_DAY' && String(r.value) === '1'), 'setup adds BACKUP_DAY');

const K = 'kid@gmail.com';
G('appendRows_')(G('readTable_')('members'), [
  { email: K, name: '小孩<b>', enabled: true, remindDays: 7, calendarEnabled: false, emailEnabled: false },
  { email: 'off@gmail.com', name: '停用', enabled: false, remindDays: 7, calendarEnabled: false, emailEnabled: false }
]);
const v = G('svcSaveVehicle_')(K, { name: 'Moto', plate: 'K-1', type: 'moto', currentMileage: 100 }).vehicle;
G('svcSaveRecord_')(K, { vehicleId: v.id, date: '2026-01-02', mileage: 100, type: 'other', title: '=HYPERLINK("x")', amount: 5 });
G('svcSaveVehicle_')('off@gmail.com', { name: 'Off', plate: 'O', type: 'car', currentMileage: 0 });

// 不是備份日、或不是 1、4、7、10 月都不寄
setDay(15);
run('2026-10-14');
run('2026-11-15');
run('2026-12-15');
assert.strictEqual(backups().length, 0, 'not backup day');

// 備份日：只寄給啟用且有車的成員（管理者沒有車）
run('2026-10-15');
assert.strictEqual(backups().length, 1, 'one backup mail');
const mail = backups()[0];
assert.strictEqual(mail.to, K);
assert.ok(mail.htmlBody.includes('小孩&lt;b&gt;') && mail.htmlBody.includes('1 台車'), 'escaped name and counts');
const file = mail.attachments[0];
assert.ok(/^CarTracker_備份_\d{4}-\d{2}-\d{2}\.json$/.test(file.getName()));
assert.strictEqual(file.getContentType(), 'application/json');
const data = JSON.parse(file.getDataAsString());
assert.deepStrictEqual(data, plain(G('svcBootstrap_')(K)), 'attachment equals bootstrap data');
assert.strictEqual(data.records[0].title, '=HYPERLINK("x")', 'original text, not the sheet escape');
assert.ok(data.vehicles.every(x => x.name !== 'Off'), 'only own data');

// 同一個月不重複寄；下一季再寄
run('2026-10-15');
assert.strictEqual(backups().length, 1, 'once per month');
run('2027-01-15');
assert.strictEqual(backups().length, 2, 'next quarter');

// 備份檔可直接匯入還原
G('svcImportAll_')(K, { vehicles: [], maintenanceItems: [], records: [] }, false);
assert.strictEqual(G('svcBootstrap_')(K).records.length, 0);
G('svcImportAll_')(K, data, false);
assert.strictEqual(G('svcBootstrap_')(K).records[0].title, '=HYPERLINK("x")', 'restored');

// 0 代表不寄
ctx.PropertiesService.getScriptProperties().setProperty('BACKUP_LAST', '');
setDay(0);
run('2027-04-15');
assert.strictEqual(backups().length, 2, 'disabled');

// 舊版設定分頁沒有 BACKUP_DAY 時預設 1 號
const t = settings();
G('deleteRows_')(t, [t.rows.find(r => r.key === 'BACKUP_DAY')._row]);
assert.strictEqual(G('backupDay_')(), 1);

// 選單：寄給自己；沒有車時不寄
G('sendBackupToMe')();
assert.strictEqual(backups().length, 2, 'owner has no vehicles');

// dailyJob 以今天日期呼叫備份：今天是備份日就寄
const today = G('today_')();
setDay(Math.min(today.getDate(), 28));
const due = today.getDate() <= 28 && [1, 4, 7, 10].includes(today.getMonth() + 1);
ctx.PropertiesService.getScriptProperties().setProperty('BACKUP_LAST', '');
G('dailyJob')();
assert.strictEqual(backups().length, due ? 3 : 2, 'dailyJob follows the schedule');
// 網頁手動寄送：只寄給登入者本人，10 分鐘內限一次
const before = backups().length;
const res = plain(G('svcEmailBackup_')(K));
assert.deepStrictEqual(res, { to: K });
assert.strictEqual(backups().length, before + 1);
assert.strictEqual(backups()[backups().length - 1].to, K);
assert.throws(() => G('svcEmailBackup_')(K), e => e.code === 'RATE_LIMIT');
assert.strictEqual(backups().length, before + 1, 'cooldown');
assert.throws(() => G('svcEmailBackup_')('owner@gmail.com'), e => e.code === 'NO_DATA', 'no vehicles');
// 寄信失敗（例如額度用完）回傳明確錯誤，且不進入冷卻
const send = ctx.MailApp.sendEmail;
ctx.MailApp.sendEmail = () => { throw new Error('quota'); };
G('svcSaveVehicle_')('owner@gmail.com', { name: 'Car', plate: 'C', type: 'car', currentMileage: 0 });
assert.throws(() => G('svcEmailBackup_')('owner@gmail.com'), e => e.code === 'MAIL');
ctx.MailApp.sendEmail = send;
G('svcEmailBackup_')('owner@gmail.com');
assert.strictEqual(backups()[backups().length - 1].to, 'owner@gmail.com');
assert.ok(G('ROUTES').emailBackup, 'route registered');
console.log('✓ backup.test.js');
