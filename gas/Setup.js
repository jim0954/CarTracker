// --- 初始化：建立分頁、欄位格式與預設設定 ---
// 第一次使用請在 Apps Script 編輯器執行 setup()，並同意授權。
// 重複執行是安全的：已存在的分頁與資料不會被清除。

const SETTING_DEFAULTS = [
  ['CLIENT_ID', '', 'Google 登入用的 OAuth 用戶端 ID（xxx.apps.googleusercontent.com）'],
  ['DEFAULT_REMIND_DAYS', '7', '新成員預設的提前提醒天數'],
  ['APP_URL', 'https://jim0954.github.io/CarTracker/', '網頁網址（顯示在日曆事件與提醒信中）'],
  ['BACKUP_DAY', '1', '每季（1、4、7、10 月）幾號寄出資料備份信給每位成員（1–28；0 代表不寄）']
];

function setup() {
  const ss = SpreadsheetApp.getActive();

  Object.keys(TABLES).forEach(key => {
    const def = TABLES[key];
    let sheet = ss.getSheetByName(def.sheet);
    if (!sheet) sheet = ss.insertSheet(def.sheet);

    // 補上缺少的欄位（不更動既有欄位）
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    def.columns.forEach(col => {
      if (headers.indexOf(col[1]) === -1) {
        const empty = headers.indexOf('');
        const pos = empty !== -1 ? empty : headers.length;
        headers[pos] = col[1];
      }
    });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#e2e8f0');
    sheet.setFrozenRows(1);

    // 欄位格式：文字欄避免被轉成數字/日期，勾選欄加上核取方塊
    // insertCheckboxes() 會把值清成 FALSE，只能套用在既有資料之後的空白列
    const maxRows = sheet.getMaxRows() - 1;
    const lastDataRow = readTable_(key).lastDataRow;
    def.columns.forEach(col => {
      const colNum = headers.indexOf(col[1]) + 1;
      const range = sheet.getRange(2, colNum, maxRows, 1);
      if (col[2] === 'text' || col[2] === 'list') range.setNumberFormat('@');
      if (col[2] === 'date') range.setNumberFormat('yyyy-mm-dd');
      if (col[2] === 'datetime') range.setNumberFormat('yyyy-mm-dd hh:mm');
      if (col[2] === 'bool' && lastDataRow < sheet.getMaxRows()) {
        sheet.getRange(lastDataRow + 1, colNum, sheet.getMaxRows() - lastDataRow, 1).insertCheckboxes();
      }
      if (col[2] === 'enum') {
        range.setDataValidation(SpreadsheetApp.newDataValidation()
          .requireValueInList(Object.values(col[3]), true).setAllowInvalid(false).build());
      }
    });
  });

  // 移除新試算表預設的空白「工作表1」
  const blank = ss.getSheets().find(s => /^(工作表1|Sheet1)$/.test(s.getName()) && s.getLastRow() === 0);
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  SETTING_DEFAULTS.forEach(([k, v, desc]) => {
    if (!readTable_('settings').rows.some(r => r.key === k)) setSetting_(k, v, desc);
  });

  // 管理者（部署者）自動加入成員
  const ownerEmail = Session.getEffectiveUser().getEmail();
  const members = readTable_('members');
  if (ownerEmail && !members.rows.some(r => r.email.toLowerCase() === ownerEmail.toLowerCase())) {
    appendRows_(members, [{
      email: ownerEmail, name: '管理者', enabled: true,
      remindDays: Number(getSetting_('DEFAULT_REMIND_DAYS')) || 7,
      calendarEnabled: true, emailEnabled: true
    }]);
  }

  // 建立保養提醒日曆、安裝每日排程
  getCalendar_();
  installTriggers_();

  SpreadsheetApp.getActive().toast('CarTracker 初始化完成', 'CarTracker', 5);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('CarTracker')
    .addItem('初始化 / 補齊欄位', 'setup')
    .addItem('立即寄一份我的資料備份', 'sendBackupToMe')
    .addToUi();
}
