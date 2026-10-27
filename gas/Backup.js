// --- 每季資料備份信 ---
// dailyJob 在 1、4、7、10 月的「BACKUP_DAY」號把每位成員自己的資料寄成 JSON 附件，
// 檔案可直接在網頁「資料備份 → 匯入 JSON」還原。只用寄信權限，不需要存取雲端硬碟。
// 已寄出的月份記在指令碼屬性 BACKUP_LAST，同一個月不會重複寄。

const BACKUP_DEFAULT_DAY = 1;
const BACKUP_MONTHS = [1, 4, 7, 10];

// 設定分頁沒有這個欄位時（舊版未重跑 setup）用預設值；填 0 代表不寄
function backupDay_() {
  const exists = readTable_('settings').rows.some(r => r.key === 'BACKUP_DAY');
  return exists ? Number(getSetting_('BACKUP_DAY')) || 0 : BACKUP_DEFAULT_DAY;
}

function sendQuarterlyBackups_(today) {
  today = today || today_();
  const day = backupDay_();
  if (!day || today.getDate() !== day || BACKUP_MONTHS.indexOf(today.getMonth() + 1) === -1) return;

  const props = PropertiesService.getScriptProperties();
  const month = formatDate_(today).slice(0, 7);
  if (props.getProperty('BACKUP_LAST') === month) return;
  props.setProperty('BACKUP_LAST', month);

  readTable_('members').rows.filter(m => m.enabled).forEach(member => {
    try {
      sendBackupMail_(member.email.toLowerCase(), member.name);
    } catch (err) {
      console.error(`寄送備份給 ${member.email} 失敗`, err);
    }
  });
}

// 沒有任何車輛的成員不寄；回傳是否寄出
function sendBackupMail_(email, name) {
  const data = svcBootstrap_(email);
  if (data.vehicles.length === 0) return false;

  const date = formatDate_(new Date());
  const blob = Utilities.newBlob(JSON.stringify(data, null, 2), 'application/json', `CarTracker_備份_${date}.json`);
  const appUrl = getSetting_('APP_URL');
  MailApp.sendEmail({
    to: email,
    name: 'CarTracker',
    subject: `💾 CarTracker 資料備份 ${date}`,
    htmlBody: `
      <div style="font-family:-apple-system,'Noto Sans TC',sans-serif;color:#0f172a;max-width:640px">
        <p>${escapeHtml_(name || email)} 您好，</p>
        <p>附件是您在 CarTracker 的資料備份：${data.vehicles.length} 台車、${data.maintenanceItems.length} 個保養項目、${data.records.length} 筆紀錄。</p>
        <p>需要還原時，開啟 CarTracker →「資料備份」→「匯入 JSON」選擇這個檔案。<b>匯入會取代您目前的雲端資料</b>，請確認是要還原的版本。</p>
        ${appUrl ? `<p><a href="${escapeHtml_(appUrl)}">${escapeHtml_(appUrl)}</a></p>` : ''}
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">每三個月（1、4、7、10 月）自動寄送。不想收到，請管理者在「設定」分頁把 BACKUP_DAY 改成 0。</p>
      </div>`,
    attachments: [blob]
  });
  return true;
}

// 試算表選單：立即寄一份自己的備份（確認備份信內容用）
function sendBackupToMe() {
  const email = Session.getEffectiveUser().getEmail().toLowerCase();
  const member = readTable_('members').rows.find(m => m.email.toLowerCase() === email);
  const sent = sendBackupMail_(email, member && member.name);
  SpreadsheetApp.getActive().toast(sent ? `已寄到 ${email}` : '您還沒有任何車輛資料', 'CarTracker', 5);
}
