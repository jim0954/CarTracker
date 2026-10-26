// --- 分頁 1：保養項目 ---
import * as store from '../store.js';
import { formatNumber, escapeHtml } from '../utils.js';

function toYmd(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

// 「加入 Google 日曆」連結：以預計到期日（雲端推算）或月數到期日建立全天事件
// 只看里程且尚無推算到期日時無法決定日期，回傳空字串
function calendarUrl(vehicle, item, fallbackDate, nextMileage) {
  const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`) : fallbackDate;
  if (!due) return '';
  const end = new Date(due);
  end.setDate(end.getDate() + 1);
  const lines = [`車輛：${vehicle.name}（${vehicle.plate}）`];
  if (nextMileage !== null) lines.push(`建議保養里程：${formatNumber(nextMileage)} km`);
  lines.push(`上次更換：${formatNumber(item.lastKm)} km（${item.lastDate || '未填'}）`);
  if (item.notes) lines.push(`備註：${item.notes}`);
  lines.push('', '由 CarTracker 建立');
  const details = lines.join('\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `🔧 ${vehicle.name} ${item.name} 保養到期`,
    dates: `${toYmd(due)}/${toYmd(end)}`,
    details
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// 依里程與月數推算狀態；週期可只設其中一個（0 或空白代表不看該條件）
function itemStatus(vehicle, item) {
  const hasKm = Number(item.intervalKm) > 0;
  const hasMonths = Number(item.intervalMonths) > 0 && !!item.lastDate;

  const nextMileage = hasKm ? item.lastKm + Number(item.intervalKm) : null;
  const remainingKm = hasKm ? nextMileage - vehicle.currentMileage : Infinity;
  const kmPercent = hasKm ? ((vehicle.currentMileage - item.lastKm) / item.intervalKm) * 100 : 0;

  let nextDate = null;
  let diffDays = Infinity;
  let timePercent = 0;
  if (hasMonths) {
    const lastDate = new Date(item.lastDate);
    nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + Number(item.intervalMonths));
    const today = new Date();
    diffDays = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
    timePercent = ((today - lastDate) / (nextDate - lastDate)) * 100;
  }
  const progress = Math.min(100, Math.max(0, kmPercent, timePercent));

  let status = 'normal'; // 'normal' | 'due-soon' | 'overdue'
  if (remainingKm <= 0 || diffDays <= 0) status = 'overdue';
  else if (remainingKm <= 500 || diffDays <= 14 || progress >= 85) status = 'due-soon';

  // 逾期時以已超過的條件顯示，否則以較接近的條件顯示
  const kmCloser = hasKm && (!hasMonths || remainingKm <= 0 || (diffDays > 0 && remainingKm / item.intervalKm <= diffDays / (item.intervalMonths * 30)));
  const prefix = status === 'overdue' ? '逾期' : '剩';
  const remainText = !hasKm && !hasMonths ? '未設定週期'
    : kmCloser ? `${prefix} ${formatNumber(Math.abs(remainingKm))} km`
    : `${prefix} ${formatNumber(Math.abs(diffDays))} 天`;
  const intervalText = [hasKm ? `每 ${formatNumber(item.intervalKm)} km` : '', Number(item.intervalMonths) > 0 ? `${item.intervalMonths} 個月` : '']
    .filter(Boolean).join(' / ') || '未設定週期';

  return { status, progress, nextMileage, nextDate, remainText, intervalText };
}

const STATUS_STYLE = {
  overdue: { text: 'text-rose-400', bar: 'bg-rose-500', dot: 'bg-rose-500 animate-pulse', rank: 0 },
  'due-soon': { text: 'text-amber-400', bar: 'bg-amber-500', dot: 'bg-amber-500', rank: 1 },
  normal: { text: 'text-emerald-400', bar: 'bg-emerald-500', dot: 'bg-emerald-500', rank: 2 }
};

// 一個項目一列：名稱、剩餘量、進度條與上次更換；點一下展開詳細資料與操作
function itemRow(vehicle, item, info) {
  const style = STATUS_STYLE[info.status];
  const calUrl = calendarUrl(vehicle, item, info.nextDate, info.nextMileage);
  const btn = 'px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition';

  const row = document.createElement('details');
  row.className = 'record-row';
  row.innerHTML = `
    <summary class="list-none px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition">
      <div class="flex items-center gap-2.5">
        <span class="w-2.5 h-2.5 shrink-0 rounded-full ${style.dot}"></span>
        <span class="font-semibold text-white truncate flex-1">${escapeHtml(item.name)}</span>
        <span class="shrink-0 text-xs font-bold ${style.text}">${escapeHtml(info.remainText)}</span>
        <i class="record-chevron fa-solid fa-chevron-down text-[10px] text-slate-600 transition-transform"></i>
      </div>
      <div class="ml-5 mt-2 mr-5 bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div class="${style.bar} h-1.5 rounded-full" style="width: ${info.progress}%"></div>
      </div>
      <div class="ml-5 mt-1.5 text-[11px] text-slate-500 font-mono">上次 ${formatNumber(item.lastKm)} km · ${escapeHtml(item.lastDate) || '未填'}</div>
    </summary>
    <div class="px-4 pb-3 pl-9 text-xs text-slate-400 space-y-1">
      ${item.notes ? `<p class="text-slate-300">${escapeHtml(item.notes)}</p>` : ''}
      <p>週期：${escapeHtml(info.intervalText)}</p>
      ${info.nextMileage !== null ? `<p>建議保養里程：<span class="font-mono text-slate-300">${formatNumber(info.nextMileage)} km</span></p>` : ''}
      ${item.dueDate ? `<p>預計到期日：<span class="font-mono text-slate-300">${escapeHtml(item.dueDate)}</span></p>` : ''}
      <div class="flex flex-wrap gap-2 pt-2">
        <button data-action="complete-item" data-id="${escapeHtml(item.id)}" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition"><i class="fa-solid fa-check-double mr-1"></i>記錄更換</button>
        <button data-action="edit-item" data-id="${escapeHtml(item.id)}" class="${btn}"><i class="fa-solid fa-gear mr-1"></i>設定</button>
        ${calUrl ? `<a href="${escapeHtml(calUrl)}" target="_blank" rel="noopener" class="${btn}" title="加入 Google 日曆"><i class="fa-regular fa-calendar-plus"></i></a>` : ''}
        <button data-action="delete-item" data-id="${escapeHtml(item.id)}" class="${btn} hover:text-rose-400" title="刪除項目"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    </div>
  `;
  return row;
}

export function renderMaintenanceTab(vehicle) {
  const container = document.getElementById('maintenance-items-grid');
  container.innerHTML = '';

  // 需要注意的排前面，同狀態依進度由高到低
  const rows = store.getItems(vehicle.id)
    .map(item => ({ item, info: itemStatus(vehicle, item) }))
    .sort((a, b) => STATUS_STYLE[a.info.status].rank - STATUS_STYLE[b.info.status].rank || b.info.progress - a.info.progress);
  const alertCount = rows.filter(r => r.info.status !== 'normal').length;

  rows.forEach(({ item, info }) => container.appendChild(itemRow(vehicle, item, info)));
  container.classList.toggle('hidden', rows.length === 0);

  // Update Alert Badges
  document.getElementById('hero-alert-count').textContent = alertCount;
  ['badge-tab-alert', 'badge-tab-alert-mobile'].forEach(id => {
    const badge = document.getElementById(id);
    badge.textContent = alertCount;
    badge.classList.toggle('hidden', alertCount === 0);
  });
}
