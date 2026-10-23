// Apps Script 服務的最小模擬（SpreadsheetApp、CalendarApp、MailApp…），讓 gas/*.js 能在 Node 執行測試
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');

function makeSheet(name) {
  const sh = {
    name, data: [], maxRows: 1000, maxCols: 26, checkboxes: new Set(),
    getName: () => name,
    getMaxRows: () => sh.maxRows,
    getLastRow: () => {
      for (let r = sh.data.length - 1; r >= 0; r--) if ((sh.data[r] || []).some(v => v !== '' && v !== undefined)) return r + 1;
      return 0;
    },
    getLastColumn: () => Math.max(0, ...sh.data.map(r => { let c = 0; (r || []).forEach((v, i) => { if (v !== '' && v !== undefined) c = i + 1; }); return c; })),
    cell: (r, c) => { while (sh.data.length < r) sh.data.push([]); const row = sh.data[r - 1]; return row[c - 1] === undefined ? '' : row[c - 1]; },
    set: (r, c, v) => { if (r > sh.maxRows) throw new Error(`row ${r} out of bounds (max ${sh.maxRows})`); while (sh.data.length < r) sh.data.push([]); sh.data[r - 1][c - 1] = v; },
    getDataRange: () => {
      const nr = Math.max(sh.getLastRow(), 1), nc = Math.max(sh.getLastColumn(), 1);
      return sh.getRange(1, 1, nr, nc);
    },
    getRange: (r, c, nr = 1, nc = 1) => {
      const range = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => sh.cell(r + i, c + j))),
        setValues: (vals) => { if (vals.length !== nr || vals[0].length !== nc) throw new Error('setValues size mismatch'); vals.forEach((row, i) => row.forEach((v, j) => sh.set(r + i, c + j, v))); return range; },
        setValue: (v) => { sh.set(r, c, v); return range; },
        insertCheckboxes: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { if (r + i <= sh.maxRows) sh.set(r + i, c + j, false); } return range; },
        setNumberFormat: () => range, setDataValidation: () => range, setFontWeight: () => range, setBackground: () => range
      };
      return range;
    },
    deleteRow: (r) => { sh.data.splice(r - 1, 1); sh.maxRows--; },
    insertRowsAfter: (after, n) => { sh.maxRows += n; },
    setFrozenRows: () => {}
  };
  return sh;
}

function makeCalendar(id, name) {
  const events = new Map();
  let n = 0;
  const cal = {
    id, name, events,
    getId: () => id,
    createAllDayEvent: (title, date, o = {}) => {
      const eid = `ev${++n}@google.com`;
      const ev = {
        id: eid, title, date, description: o.description, guests: o.guests, sendInvites: o.sendInvites, reminders: [],
        getId: () => eid,
        setTitle: (t) => { ev.title = t; }, setDescription: (d) => { ev.description = d; },
        setAllDayDate: (d) => { ev.date = d; },
        removeAllReminders: () => { ev.reminders = []; }, addPopupReminder: (m) => { ev.reminders.push(m); },
        deleteEvent: () => { events.delete(eid); }
      };
      events.set(eid, ev);
      return ev;
    },
    getEventById: (eid) => events.get(eid) || null
  };
  return cal;
}

function createContext(opts = {}) {
  const calendars = new Map();
  const mail = [];
  const triggers = [];
  const sheets = [makeSheet('工作表1')];
  const ss = {
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet: n => { const s = makeSheet(n); sheets.push(s); return s; },
    getSheets: () => sheets.slice(),
    deleteSheet: s => sheets.splice(sheets.indexOf(s), 1),
    toast: () => {}
  };
  const fetchLog = [];
  const ctx = {
    console,
    SpreadsheetApp: {
      getActive: () => ss,
      getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }),
      newDataValidation: () => { const b = { requireValueInList: () => b, setAllowInvalid: () => b, build: () => ({}) }; return b; }
    },
    Session: { getScriptTimeZone: () => 'Asia/Taipei', getEffectiveUser: () => ({ getEmail: () => opts.ownerEmail || 'owner@gmail.com' }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, fmt) => {
        const t = new Date(d.getTime() + 8 * 3600 * 1000);
        const p = n => String(n).padStart(2, '0');
        return fmt.replace('yyyy', t.getUTCFullYear()).replace('MM', p(t.getUTCMonth() + 1)).replace('dd', p(t.getUTCDate()));
      },
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s).digest()),
      base64EncodeWebSafe: (b) => Buffer.from(b.map(x => x & 255)).toString('base64url'),
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' }
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: (() => { const m = new Map(); return { getScriptCache: () => ({ get: k => m.get(k) || null, put: (k, v) => m.set(k, v), remove: k => m.delete(k) }) }; })(),
    UrlFetchApp: {
      fetch: (url, o) => { fetchLog.push(url); return opts.fetch(url, o); }
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; }, getContent() { return s; } })
    },
    _sheets: sheets, _fetchLog: fetchLog,
    _calendars: calendars, _mail: mail, _triggers: triggers,
    CalendarApp: {
      createCalendar: (name, o) => { const c = makeCalendar('cal' + (calendars.size + 1), name); calendars.set(c.id, c); return c; },
      getCalendarById: id => calendars.get(id) || null
    },
    MailApp: { sendEmail: (o) => mail.push(o), getRemainingDailyQuota: () => 100 },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      newTrigger: (fn) => { const t = { fn, hour: null }; const b = { timeBased: () => b, everyDays: () => b, atHour: (h) => { t.hour = h; return b; }, inTimezone: () => b, create: () => { triggers.push({ getHandlerFunction: () => fn, hour: t.hour }); } }; return b; },
      deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1)
    }
  };
  Object.assign(ctx, opts.extra || {});
  vm.createContext(ctx);
  const dir = opts.dir;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  const src = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n;\n');
  vm.runInContext(src + '\n;this.__get = (n) => eval(n);', ctx);
  return ctx;
}

module.exports = { createContext };
