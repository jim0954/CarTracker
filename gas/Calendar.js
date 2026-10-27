// --- Google 日曆同步 ---
// 在管理者帳號建立專用日曆「車輛保養提醒」，每個保養項目一個全天事件（預計到期日），
// 並邀請該項目的擁有者，事件就會出現在家人自己的 Google 日曆。
// 日曆操作失敗不影響資料儲存，只記錄錯誤。

const CALENDAR_NAME = '🚗 車輛保養提醒';
const REMIND_HOUR = 9; // 提醒時間：到期前 N 天的早上 9 點

function getMember_(email) {
  return readTable_('members').rows.find(r => r.email.toLowerCase() === email) || null;
}

// 取得（必要時建立）專用日曆，日曆 ID 存在「設定」分頁
function getCalendar_() {
  const id = getSetting_('CALENDAR_ID');
  if (id) {
    const cal = CalendarApp.getCalendarById(id);
    if (cal) return cal;
  }
  const cal = CalendarApp.createCalendar(CALENDAR_NAME, { timeZone: Session.getScriptTimeZone() });
  setSetting_('CALENDAR_ID', cal.getId(), 'CarTracker 自動建立的保養提醒日曆（請勿修改）');
  return cal;
}

function eventTitle_(vehicle, item) {
  return `🔧 ${vehicle.name} ${item.name} 保養到期`;
}

function eventDescription_(vehicle, item) {
  const lines = [`車輛：${vehicle.name}（${vehicle.plate}）`];
  if (Number(item.intervalKm) > 0) lines.push(`建議保養里程：${Number(item.lastKm || 0) + Number(item.intervalKm)} km`);
  lines.push(`上次更換：${item.lastKm || 0} km（${item.lastDate || '未填'}）`);
  if (item.notes) lines.push(`備註：${item.notes}`);
  const appUrl = getSetting_('APP_URL');
  lines.push('', '由 CarTracker 自動建立' + (appUrl ? `：${appUrl}` : ''));
  return lines.join('\n');
}

// 全天事件的提醒分鐘數是相對於當天 00:00：提前 days 天的 9 點 = days*1440 - 9*60
function applyReminders_(event, remindDays) {
  event.removeAllReminders();
  const days = Math.max(1, Math.min(Number(remindDays) || 7, 27));
  event.addPopupReminder(days * 1440 - REMIND_HOUR * 60);
  if (days > 1) event.addPopupReminder(1440 - REMIND_HOUR * 60);
}

// 建立或更新項目的日曆事件，回傳事件 ID（停用日曆提醒或沒有到期日時刪除事件並回傳 ''）
function syncItemEvent_(email, item, vehicle, member) {
  try {
    member = member || getMember_(email);
    const enabled = member && member.enabled && member.calendarEnabled;
    if (!enabled || !item.dueDate) {
      if (item.calendarEventId) deleteItemEvent_(item.calendarEventId);
      return '';
    }

    const cal = getCalendar_();
    const date = parseDate_(item.dueDate);
    // 事件可能已在日曆上被手動刪除：取不到或更新失敗就重新建立，避免卡在無效的事件 ID
    let event = null;
    if (item.calendarEventId) {
      try {
        event = cal.getEventById(item.calendarEventId);
        if (event) {
          event.setTitle(eventTitle_(vehicle, item));
          event.setDescription(eventDescription_(vehicle, item));
          event.setAllDayDate(date);
        }
      } catch (err) {
        console.warn('日曆事件無法更新，重新建立', err);
        event = null;
      }
    }

    if (!event) {
      // 管理者自己的項目不需要邀請（日曆本來就在自己帳號）
      const isOwner = email === String(Session.getEffectiveUser().getEmail()).toLowerCase();
      event = cal.createAllDayEvent(eventTitle_(vehicle, item), date, {
        description: eventDescription_(vehicle, item),
        guests: isOwner ? '' : email,
        sendInvites: !isOwner
      });
    }
    applyReminders_(event, member.remindDays);
    return event.getId();
  } catch (err) {
    console.error('日曆同步失敗', err);
    return item.calendarEventId || '';
  }
}

function deleteItemEvent_(eventId) {
  if (!eventId) return;
  try {
    const event = getCalendar_().getEventById(eventId);
    if (event) event.deleteEvent();
  } catch (err) {
    console.error('刪除日曆事件失敗', err);
  }
}

// 每日排程用：補建缺少的事件、刪除已停用成員的事件
function syncAllCalendars_() {
  const vehicles = readTable_('vehicles').rows;
  const members = readTable_('members').rows;
  const owners = [...new Set(vehicles.map(v => v.owner))];
  owners.forEach(email => {
    const member = members.find(m => m.email.toLowerCase() === email) || null;
    const items = readTable_('items');
    items.rows.filter(r => r.owner === email).forEach(row => {
      const vehicle = vehicles.find(v => v.id === row.vehicleId);
      if (!vehicle) return;
      const enabled = member && member.enabled && member.calendarEnabled;
      if ((enabled && row.dueDate && !row.calendarEventId) || (!enabled && row.calendarEventId)) {
        const eventId = syncItemEvent_(email, row, vehicle, member);
        if (eventId !== row.calendarEventId) updateRow_(items, row._row, { calendarEventId: eventId });
      }
    });
  });
}
