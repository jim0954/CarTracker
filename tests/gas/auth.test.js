// Tests for gas Auth/Code under mock
const assert = require('assert');
const { createContext } = require('./gas-mock');
const dir = process.argv[2] || require('path').join(__dirname, '../../gas');
const CLIENT = 'test-client.apps.googleusercontent.com';
const now = Math.floor(Date.now() / 1000);

const tokens = {
  good: { aud: CLIENT, iss: 'https://accounts.google.com', email: 'Owner@gmail.com', email_verified: 'true', exp: now + 3600, name: 'Owner' },
  family: { aud: CLIENT, iss: 'accounts.google.com', email: 'kid@gmail.com', email_verified: 'true', exp: now + 3600, name: 'Kid' },
  stranger: { aud: CLIENT, iss: 'accounts.google.com', email: 'evil@gmail.com', email_verified: 'true', exp: now + 3600 },
  wrongAud: { aud: 'other', iss: 'accounts.google.com', email: 'owner@gmail.com', email_verified: 'true', exp: now + 3600 },
  unverified: { aud: CLIENT, iss: 'accounts.google.com', email: 'owner@gmail.com', email_verified: 'false', exp: now + 3600 }
};

const ctx = createContext({
  dir,
  fetch: (url) => {
    const t = decodeURIComponent(url.split('id_token=')[1]);
    const claims = tokens[t];
    return { getResponseCode: () => (claims ? 200 : 400), getContentText: () => JSON.stringify(claims || { error: 'invalid_token' }) };
  }
});
const G = ctx.__get;
G('setup')();

const call = (action, idToken, payload) => JSON.parse(G('doPost')({ postData: { contents: JSON.stringify({ action, idToken, payload }) } }).getContent());

// CLIENT_ID not set yet
assert.strictEqual(call('bootstrap', 'good').code, 'SETUP');
G('setSetting_')('CLIENT_ID', CLIENT);

assert.strictEqual(JSON.parse(G('doGet')().getContent()).ok, true);
assert.strictEqual(call('bootstrap').code, 'AUTH_REQUIRED');
assert.strictEqual(call('bootstrap', 'garbage').code, 'AUTH_INVALID');
assert.strictEqual(call('bootstrap', 'wrongAud').code, 'AUTH_INVALID');
assert.strictEqual(call('bootstrap', 'unverified').code, 'AUTH_INVALID');
assert.strictEqual(call('bootstrap', 'stranger').code, 'NOT_MEMBER');
assert.strictEqual(call('nope', 'good').code, 'BAD_ACTION');

// owner (mixed case email) is member via setup
const boot = call('bootstrap', 'good');
assert.ok(boot.ok, JSON.stringify(boot));
assert.strictEqual(boot.data.user.email, 'owner@gmail.com');
assert.deepStrictEqual(boot.data.vehicles, []);

// token cached: second call does not refetch
const before = ctx._fetchLog.length;
call('bootstrap', 'good');
assert.strictEqual(ctx._fetchLog.length, before, 'cached');

// add family member, disable later
const members = G('readTable_')('members');
G('appendRows_')(members, [{ email: 'kid@gmail.com', name: '小孩', enabled: true, remindDays: 7 }]);
const v = call('saveVehicle', 'family', { vehicle: { name: 'Kid moto', plate: 'K-1', type: 'moto', year: 2024, currentMileage: 10 } });
assert.ok(v.ok);
assert.strictEqual(call('bootstrap', 'good').data.vehicles.length, 0, 'owner does not see kid data');
assert.strictEqual(call('bootstrap', 'family').data.user.name, '小孩');
assert.strictEqual(call('deleteVehicle', 'good', { id: v.data.id }).code, 'NOT_FOUND');

const m2 = G('readTable_')('members');
const kidRow = m2.rows.find(r => r.email === 'kid@gmail.com');
G('updateRow_')(m2, kidRow._row, { enabled: false });
assert.strictEqual(call('bootstrap', 'family').code, 'NOT_MEMBER', 'disable takes effect immediately');

// server error hides details
const orig = G('svcBootstrap_');
ctx.svcBootstrap_ = () => { throw new Error('boom secret'); };
const err = call('bootstrap', 'good');
assert.strictEqual(err.code, 'SERVER_ERROR');
assert.ok(!err.error.includes('secret'));

console.log('auth/code tests passed');
