// 本機模擬 GAS 後台：用 Node 執行 gas/*.js，供前端在沒有 Google 設定時做端對端測試。
// 用法：node tests/gas/mock-server.js [port=5174] [延遲毫秒=300]
// js/config.js 暫時設 GAS_URL = http://127.0.0.1:5174/exec、GOOGLE_CLIENT_ID = 000-test.apps.googleusercontent.com，
// 並在 localStorage 放一個假的 cartracker_id_token（JWT 形狀，payload 需含 email、exp，以及 aud = 上面的 CLIENT_ID、iss = accounts.google.com；成員：test@gmail.com、kid@gmail.com）。
// tokeninfo 為模擬：不驗證簽章，直接解出 JWT 內容。GET /debug 查看所有分頁資料，GET /fail 讓下一個請求失敗。
const http = require('http');
const path = require('path');
const { createContext } = require('./gas-mock');
const dir = path.join(__dirname, '../../gas');
const port = Number(process.argv[2] || 5174);
const delay = Number(process.argv[3] || 300);
const CLIENT = '000-test.apps.googleusercontent.com';

const ctx = createContext({
  dir,
  fetch: (url) => {
    try {
      const t = decodeURIComponent(url.split('id_token=')[1]);
      const claims = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ ...claims, aud: CLIENT, iss: 'accounts.google.com', email_verified: 'true' }) };
    } catch (e) {
      return { getResponseCode: () => 400, getContentText: () => '{}' };
    }
  }
});
const G = ctx.__get;
G('setup')();
G('setSetting_')('CLIENT_ID', CLIENT);
G('appendRows_')(G('readTable_')('members'), [
  { email: 'test@gmail.com', name: '測試者', enabled: true, remindDays: 7, calendarEnabled: true, emailEnabled: true },
  { email: 'kid@gmail.com', name: '小孩', enabled: true, remindDays: 7, calendarEnabled: true, emailEnabled: true }
]);
ctx.__failNext = 0;

http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'GET' && req.url.startsWith('/debug')) {
    const out = {};
    ctx._sheets.forEach(s => { out[s.name] = G('readTable_')(Object.keys(G('TABLES')).find(k => G('TABLES')[k].sheet === s.name) || 'settings').rows; });
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(out));
  }
  if (req.method === 'GET' && req.url.startsWith('/fail')) {
    ctx.__failNext = 1;
    res.writeHead(200, cors);
    return res.end('ok');
  }
  if (req.method === 'GET') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end(G('doGet')().getContent());
  }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => setTimeout(() => {
    let out;
    if (ctx.__failNext) {
      ctx.__failNext = 0;
      out = JSON.stringify({ ok: false, code: 'SERVER_ERROR', error: '模擬伺服器錯誤' });
    } else {
      out = G('doPost')({ postData: { contents: body } }).getContent();
    }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(out);
  }, delay));
}).listen(port, '127.0.0.1', () => console.log('mock GAS on', port));
