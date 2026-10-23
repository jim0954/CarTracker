const assert = require('assert');
const { createContext } = require('./gas-mock');
const ctx = createContext({ dir: process.argv[2] || require('path').join(__dirname, '../../gas'), ownerEmail: 'owner@gmail.com' });
const G = ctx.__get;
G('setup')();
G('setup')();
assert.strictEqual(ctx._triggers.filter(t => t.getHandlerFunction() === 'dailyJob').length, 1, 'one daily trigger');
assert.strictEqual(ctx._triggers[0].hour, 8);

const K = 'kid@gmail.com';
G('appendRows_')(G('readTable_')('members'), [{ email: K, name: '小孩<b>', enabled: true, remindDays: 7, calendarEnabled: false, emailEnabled: true }]);
const fmt = G('formatDate_');
const today = G('today_')();
const plus = d => fmt(new Date(today.getTime() + d * 86400000));

const v = G('svcSaveVehicle_')(K, { name: 'Moto<script>', plate: 'K-1', type: 'moto', currentMileage: 0 }).vehicle;
// month-based due dates relative to today (no mileage rate): lastDate chosen so due = today + N
const mk = (name, dueOffset) => {
  const it = G('svcSaveItem_')(K, { vehicleId: v.id, name, intervalKm: 0, intervalMonths: 1, lastKm: 0, lastDate: plus(dueOffset - 30) }).item;
  // force exact due date for the test
  const items = G('readTable_')('items');
  G('updateRow_')(items, items.rows.find(r => r.id === it.id)._row, { dueDate: plus(dueOffset) });
  return it;
};
mk('soon', 3);
mk('overdue', -2);
mk('far', 30);
mk('today', 0);

G('sendReminders_')();
assert.strictEqual(ctx._mail.length, 1, 'one email for kid');
const mail = ctx._mail[0];
assert.strictEqual(mail.to, K);
assert.ok(mail.subject.includes('3 個項目'), mail.subject);
assert.ok(mail.htmlBody.includes('soon') && mail.htmlBody.includes('overdue') && mail.htmlBody.includes('today'));
assert.ok(!mail.htmlBody.includes('far'));
assert.ok(!mail.htmlBody.includes('<script>') && mail.htmlBody.includes('&lt;script&gt;'), 'escaped');
assert.ok(mail.htmlBody.includes('已逾期 2 天') && mail.htmlBody.includes('今天到期') && mail.htmlBody.includes('剩 3 天'));

// second run same day: nothing new
G('sendReminders_')();
assert.strictEqual(ctx._mail.length, 1, 'no duplicate');

// 'soon' item reaches due date -> one more mail
const items = G('readTable_')('items');
const soon = items.rows.find(r => r.name === 'soon');
G('updateRow_')(items, soon._row, { dueDate: plus(0), notified: `${plus(0)}|early` });
G('sendReminders_')();
assert.strictEqual(ctx._mail.length, 2, 'due-day mail');
assert.ok(ctx._mail[1].htmlBody.includes('soon'));

// item gets serviced -> new due date -> reminders reset naturally
G('updateRow_')(items, soon._row, { dueDate: plus(5) });
G('sendReminders_')();
assert.strictEqual(ctx._mail.length, 3, 'new due date triggers early reminder again');

// email disabled -> no mail
const m = G('readTable_')('members');
G('updateRow_')(m, m.rows.find(r => r.email === K)._row, { emailEnabled: false });
G('updateRow_')(items, soon._row, { dueDate: plus(1) });
G('sendReminders_')();
assert.strictEqual(ctx._mail.length, 3, 'disabled');

// client never sees notified
assert.strictEqual(G('svcBootstrap_')(K).maintenanceItems[0].notified, undefined);

// dailyJob runs end to end
G('dailyJob')();
console.log('reminder tests passed');
