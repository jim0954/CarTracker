// --- 每日排程：重新推算到期日、補齊日曆事件、寄送 Email 提醒與每季備份信 ---
// setup() 會安裝每天早上 8 點執行 dailyJob 的觸發器。
// 每個項目的同一個到期日最多寄兩次：進入提前提醒天數時一次、到期當天（或已逾期）一次。
// 寄送狀態記在「保養項目」的「已提醒」欄，格式為「到期日|early」或「到期日|due」。

const DAILY_JOB_HOUR = 8;

function dailyJob() {
  const vehicles = readTable_('vehicles').rows;
  vehicles.forEach(v => refreshDueDates_(v.owner, v.id, true));
  syncAllCalendars_();
  sendReminders_();
  try {
    sendQuarterlyBackups_();
  } catch (err) {
    console.error('每季備份信失敗', err);
  }
}

function installTriggers_() {
  const exists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'dailyJob');
  if (!exists) {
    ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(DAILY_JOB_HOUR).create();
  }
}

function escapeHtml_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 回傳 { overdue: [...], upcoming: [...] }，每筆含 row、vehicle、daysLeft
function collectDueItems_(email, remindDays, items, vehicles, today) {
  const result = { overdue: [], upcoming: [] };
  items.filter(r => r.owner === email && r.dueDate).forEach(row => {
    const vehicle = vehicles.find(v => v.id === row.vehicleId);
    const due = parseDate_(row.dueDate);
    if (!vehicle || !due) return;
    const daysLeft = Math.round((due.getTime() - today.getTime()) / DAY_MS);
    const notified = String(row.notified || '');
    if (daysLeft <= 0 && notified !== `${row.dueDate}|due`) {
      result.overdue.push({ row, vehicle, daysLeft, mark: `${row.dueDate}|due` });
    } else if (daysLeft > 0 && daysLeft <= remindDays && notified.indexOf(`${row.dueDate}|`) !== 0) {
      result.upcoming.push({ row, vehicle, daysLeft, mark: `${row.dueDate}|early` });
    }
  });
  return result;
}

function reminderHtml_(name, due) {
  const rowHtml = ({ row, vehicle, daysLeft }) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml_(vehicle.name)}<br><span style="color:#64748b;font-size:12px">${escapeHtml_(vehicle.plate)}</span></td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml_(row.name)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml_(row.dueDate)}<br><span style="color:${daysLeft <= 0 ? '#e11d48' : '#d97706'};font-size:12px">${daysLeft <= 0 ? (daysLeft === 0 ? '今天到期' : `已逾期 ${-daysLeft} 天`) : `剩 ${daysLeft} 天`}</span></td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${Number(row.intervalKm) > 0 ? `${Number(row.lastKm || 0) + Number(row.intervalKm)} km` : '—'}</td>
    </tr>`;
  const table = (title, list) => list.length === 0 ? '' : `
    <h3 style="margin:20px 0 8px">${title}</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr style="background:#f1f5f9;text-align:left">
        <th style="padding:6px 10px">車輛</th><th style="padding:6px 10px">保養項目</th>
        <th style="padding:6px 10px">預計到期日</th><th style="padding:6px 10px">建議保養里程</th>
      </tr>
      ${list.map(rowHtml).join('')}
    </table>`;
  const appUrl = getSetting_('APP_URL');
  return `
    <div style="font-family:-apple-system,'Noto Sans TC',sans-serif;color:#0f172a;max-width:640px">
      <p>${escapeHtml_(name)} 您好，</p>
      <p>以下保養項目需要注意：</p>
      ${table('⚠️ 已到期', due.overdue)}
      ${table('⏰ 即將到期', due.upcoming)}
      ${appUrl ? `<p style="margin-top:24px"><a href="${escapeHtml_(appUrl)}" style="background:#059669;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">開啟 CarTracker 記錄保養</a></p>` : ''}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">到期日依保養週期與平均每日里程推算。不想收到提醒信，請管理者在「成員」分頁取消勾選「Email提醒」。</p>
    </div>`;
}

function sendReminders_() {
  const today = today_();
  const members = readTable_('members').rows.filter(m => m.enabled && m.emailEnabled);
  const vehicles = readTable_('vehicles').rows;
  const items = readTable_('items');
  const defaultDays = Number(getSetting_('DEFAULT_REMIND_DAYS')) || 7;

  members.forEach(member => {
    const email = member.email.toLowerCase();
    const due = collectDueItems_(email, Number(member.remindDays) || defaultDays, items.rows, vehicles, today);
    const all = due.overdue.concat(due.upcoming);
    if (all.length === 0) return;

    try {
      MailApp.sendEmail({
        to: email,
        name: 'CarTracker',
        subject: `🔧 CarTracker 保養提醒：${all.length} 個項目${due.overdue.length ? '已到期或' : ''}即將到期`,
        htmlBody: reminderHtml_(member.name || email, due)
      });
      all.forEach(({ row, mark }) => updateRow_(items, row._row, { notified: mark }));
    } catch (err) {
      console.error(`寄送提醒給 ${email} 失敗`, err);
    }
  });
}
