// --- 試算表資料表定義與讀寫 ---
// 每個分頁第一列為中文欄位名稱，程式依欄名對應，欄位順序可以自由調整。
// 欄位格式：[程式欄位, 試算表欄名, 型別, 列舉對照(選填)]

const VEHICLE_TYPES = { moto: '機車', car: '汽車' };
const RECORD_TYPES = { maintenance: '保養維修', fuel: '加油', tax: '稅費保險', other: '其他' };

const TABLES = {
  members: {
    sheet: '成員',
    columns: [
      ['email', 'Email', 'text'],
      ['name', '顯示名稱', 'text'],
      ['enabled', '啟用', 'bool'],
      ['remindDays', '提前提醒天數', 'number'],
      ['calendarEnabled', '日曆提醒', 'bool'],
      ['emailEnabled', 'Email提醒', 'bool']
    ]
  },
  vehicles: {
    sheet: '車輛',
    columns: [
      ['id', 'ID', 'text'],
      ['owner', '擁有者Email', 'text'],
      ['name', '車名', 'text'],
      ['plate', '車牌', 'text'],
      ['type', '類型', 'enum', VEHICLE_TYPES],
      ['year', '年份', 'number'],
      ['currentMileage', '目前里程', 'number'],
      ['initialMileage', '起始里程', 'number'],
      ['notes', '備註', 'text'],
      ['createdAt', '建立時間', 'datetime'],
      ['updatedAt', '更新時間', 'datetime']
    ]
  },
  items: {
    sheet: '保養項目',
    columns: [
      ['id', 'ID', 'text'],
      ['owner', '擁有者Email', 'text'],
      ['vehicleId', '車輛ID', 'text'],
      ['name', '項目名稱', 'text'],
      ['intervalKm', '間隔公里', 'number'],
      ['intervalMonths', '間隔月數', 'number'],
      ['lastKm', '上次里程', 'number'],
      ['lastDate', '上次日期', 'date'],
      ['dueDate', '預計到期日', 'date'],
      ['calendarEventId', '日曆事件ID', 'text'],
      ['notified', '已提醒', 'text'],
      ['notes', '備註', 'text'],
      ['updatedAt', '更新時間', 'datetime']
    ]
  },
  records: {
    sheet: '紀錄',
    columns: [
      ['id', 'ID', 'text'],
      ['owner', '擁有者Email', 'text'],
      ['vehicleId', '車輛ID', 'text'],
      ['date', '日期', 'date'],
      ['mileage', '里程', 'number'],
      ['type', '類型', 'enum', RECORD_TYPES],
      ['title', '標題', 'text'],
      ['amount', '金額', 'number'],
      ['vendor', '店家', 'text'],
      ['liters', '公升', 'number'],
      ['pricePerLiter', '單價', 'number'],
      ['isFullTank', '加滿', 'bool'],
      ['itemIds', '保養項目IDs', 'list'],
      ['parts', '項目明細', 'json'],
      ['notes', '備註', 'text'],
      ['createdAt', '建立時間', 'datetime'],
      ['updatedAt', '更新時間', 'datetime']
    ]
  },
  settings: {
    sheet: '設定',
    columns: [
      ['key', '項目', 'text'],
      ['value', '值', 'text'],
      ['description', '說明', 'text']
    ]
  }
};

function getSheet_(tableKey) {
  const name = TABLES[tableKey].sheet;
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new AppError_('SETUP', `找不到「${name}」分頁，請先執行 setup()`);
  return sheet;
}

// --- 型別轉換 ---
function toSheetValue_(col, value) {
  const type = col[2];
  if (value === undefined || value === null) return type === 'bool' ? false : '';
  switch (type) {
    case 'number':
      return value === '' || isNaN(Number(value)) ? '' : Number(value);
    case 'bool':
      return value === true || value === 'true';
    case 'enum':
      return col[3][value] || value;
    case 'list':
      return Array.isArray(value) ? value.join(',') : String(value);
    case 'json':
      return Array.isArray(value) && value.length === 0 ? '' : JSON.stringify(value);
    case 'datetime':
      return value instanceof Date ? value : new Date(value);
    default:
      return String(value);
  }
}

function fromSheetValue_(col, value) {
  const type = col[2];
  switch (type) {
    case 'number':
      return value === '' || value === null ? null : Number(value);
    case 'bool':
      return value === true || String(value).toUpperCase() === 'TRUE';
    case 'enum': {
      const entry = Object.entries(col[3]).find(([, label]) => label === value);
      return entry ? entry[0] : String(value);
    }
    case 'list':
      return String(value).split(',').map(s => s.trim()).filter(Boolean);
    case 'json':
      try {
        return value === '' || value === null ? [] : JSON.parse(value);
      } catch (e) {
        return [];
      }
    case 'date':
      return value instanceof Date ? formatDate_(value) : String(value);
    case 'datetime':
      return value instanceof Date ? value.toISOString() : String(value);
    default:
      return value === null ? '' : String(value);
  }
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// --- 讀寫 ---
// 回傳 { sheet, columns: [{col, index}], width, lastDataRow, rows: [{...資料, _row}] }
// 勾選欄的空白核取方塊值為 FALSE，所以不能用 getLastRow() 判斷資料結尾
function readTable_(tableKey) {
  const sheet = getSheet_(tableKey);
  let values = sheet.getDataRange().getValues();
  // 程式新增的欄位自動補上標題，不需要重新執行 setup()
  const missing = TABLES[tableKey].columns.filter(col => values[0].map(h => String(h).trim()).indexOf(col[1]) === -1);
  if (missing.length) {
    sheet.getRange(1, values[0].length + 1, 1, missing.length).setValues([missing.map(col => col[1])])
      .setFontWeight('bold').setBackground('#e2e8f0');
    values = sheet.getDataRange().getValues();
  }
  const headers = values[0].map(h => String(h).trim());
  const columns = TABLES[tableKey].columns
    .map(col => ({ col, index: headers.indexOf(col[1]) }))
    .filter(c => c.index !== -1);

  const rows = [];
  let lastDataRow = 1;
  for (let r = 1; r < values.length; r++) {
    const line = values[r];
    if (line.every(v => v === '' || v === false)) continue; // 略過空白列
    lastDataRow = r + 1;
    const obj = { _row: r + 1 };
    columns.forEach(({ col, index }) => {
      obj[col[0]] = fromSheetValue_(col, line[index]);
    });
    rows.push(obj);
  }
  return { sheet, columns, width: headers.length, lastDataRow, rows };
}

function toSheetLine_(table, obj) {
  const line = new Array(table.width).fill('');
  table.columns.forEach(({ col, index }) => {
    line[index] = toSheetValue_(col, obj[col[0]]);
  });
  return line;
}

function appendRows_(table, objs) {
  if (objs.length === 0) return;
  const lines = objs.map(obj => toSheetLine_(table, obj));
  const start = table.lastDataRow + 1;
  const maxRows = table.sheet.getMaxRows();
  const needed = start + lines.length - 1 - maxRows;
  if (needed > 0) table.sheet.insertRowsAfter(maxRows, needed); // 新列沿用上一列格式
  // insertCheckboxes() 會把值清成 FALSE，所以要在寫入資料前先插入
  table.columns.forEach(({ col, index }) => {
    if (col[2] === 'bool') table.sheet.getRange(start, index + 1, lines.length, 1).insertCheckboxes();
  });
  table.sheet.getRange(start, 1, lines.length, table.width).setValues(lines);
  table.lastDataRow += lines.length;
}

// 只寫入 obj 內有的欄位，其他欄位（例如手動加的欄）保持不變
function updateRow_(table, rowNum, obj) {
  table.columns.forEach(({ col, index }) => {
    if (!(col[0] in obj)) return;
    table.sheet.getRange(rowNum, index + 1).setValue(toSheetValue_(col, obj[col[0]]));
  });
}

// 由下往上刪，避免列號位移；連續的列合併成一次 deleteRows，大量刪除（覆蓋匯入）時不會逐列呼叫
function deleteRows_(table, rowNums) {
  const sorted = [...new Set(rowNums)].sort((a, b) => b - a);
  let i = 0;
  while (i < sorted.length) {
    let start = sorted[i];
    let count = 1;
    while (i + count < sorted.length && sorted[i + count] === start - 1) {
      start--;
      count++;
    }
    table.sheet.deleteRows(start, count);
    i += count;
  }
}

function newId_(prefix) {
  return `${prefix}_${Utilities.getUuid().replace(/-/g, '').slice(0, 12)}`;
}

// --- 設定分頁 ---
function getSetting_(key) {
  const row = readTable_('settings').rows.find(r => r.key === key);
  return row ? row.value : '';
}

function setSetting_(key, value, description) {
  const table = readTable_('settings');
  const row = table.rows.find(r => r.key === key);
  if (row) {
    updateRow_(table, row._row, { value });
  } else {
    appendRows_(table, [{ key, value, description: description || '' }]);
  }
}

// 錯誤代碼會回傳給前端，讓畫面顯示對應訊息
class AppError_ extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
