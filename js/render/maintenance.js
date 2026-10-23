// --- 分頁 1：保養項目 ---
import * as store from '../store.js';
import { formatNumber, escapeHtml } from '../utils.js';

function toYmd(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

// 「加入 Google 日曆」連結：以預計到期日（雲端推算）或月數到期日建立全天事件
function calendarUrl(vehicle, item, fallbackDate, nextMileage) {
  const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`) : fallbackDate;
  const end = new Date(due);
  end.setDate(end.getDate() + 1);
  const lines = [
    `車輛：${vehicle.name}（${vehicle.plate}）`,
    `建議保養里程：${formatNumber(nextMileage)} km`,
    `上次更換：${formatNumber(item.lastKm)} km（${item.lastDate || '未填'}）`
  ];
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

export function renderMaintenanceTab(vehicle) {
  const container = document.getElementById('maintenance-items-grid');
  container.innerHTML = '';

  const items = store.getItems(vehicle.id);
  let alertCount = 0;

  items.forEach(item => {
    const nextMileage = item.lastKm + item.intervalKm;
    const remainingKm = nextMileage - vehicle.currentMileage;
    const progressPercent = Math.min(100, Math.max(0, ((vehicle.currentMileage - item.lastKm) / item.intervalKm) * 100));

    // Date calculations
    const lastDateObj = new Date(item.lastDate || '2023-01-01');
    const nextDateObj = new Date(lastDateObj);
    nextDateObj.setMonth(nextDateObj.getMonth() + (item.intervalMonths || 6));
    const today = new Date();
    const diffDays = Math.ceil((nextDateObj - today) / (1000 * 60 * 60 * 24));

    // Health Status Logic
    let status = 'normal'; // 'normal' | 'due-soon' | 'overdue'
    if (remainingKm <= 0 || diffDays <= 0) {
      status = 'overdue';
      alertCount++;
    } else if (remainingKm <= 500 || diffDays <= 14 || progressPercent >= 85) {
      status = 'due-soon';
      alertCount++;
    }

    const card = document.createElement('div');
    card.className = `relative bg-slate-850 rounded-2xl p-5 border transition-all duration-200 hover:border-slate-600 flex flex-col justify-between ${
      status === 'overdue' ? 'border-rose-500/60 shadow-lg shadow-rose-950/20' :
      status === 'due-soon' ? 'border-amber-500/60 shadow-lg shadow-amber-950/20' :
      'border-slate-800'
    }`;

    let badgeHtml = '';
    let progressColor = 'bg-emerald-500';

    if (status === 'overdue') {
      badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i>已逾期 (超過 ${Math.abs(remainingKm)} km)
      </span>`;
      progressColor = 'bg-rose-500';
    } else if (status === 'due-soon') {
      badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
        <i class="fa-solid fa-clock mr-1"></i>即將到期 (剩 ${remainingKm} km)
      </span>`;
      progressColor = 'bg-amber-500';
    } else {
      badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <i class="fa-solid fa-check mr-1"></i>狀態良好 (剩 ${remainingKm} km)
      </span>`;
      progressColor = 'bg-emerald-500';
    }

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-2 mb-3">
          <div>
            <h4 class="text-base font-bold text-white tracking-tight">${escapeHtml(item.name)}</h4>
            <p class="text-xs text-slate-400 mt-0.5">${escapeHtml(item.notes) || '一般定期更換'}</p>
          </div>
          ${badgeHtml}
        </div>

        <!-- Progress Bar -->
        <div class="mt-4 mb-3">
          <div class="flex justify-between text-xs text-slate-400 mb-1">
            <span>週期使用進度</span>
            <span class="font-mono font-bold ${status === 'overdue' ? 'text-rose-400' : 'text-slate-300'}">${Math.round(progressPercent)}%</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div class="${progressColor} h-2.5 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
          </div>
        </div>

        <!-- Data metrics -->
        <div class="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 mt-3">
          <div>
            <span class="text-slate-500 block">上次更換里程</span>
            <span class="font-mono text-slate-300 font-semibold">${formatNumber(item.lastKm)} km</span>
            <span class="text-[10px] text-slate-500 block">${escapeHtml(item.lastDate) || '未填'}</span>
          </div>
          <div>
            <span class="text-slate-500 block">建議保養里程</span>
            <span class="font-mono text-slate-300 font-semibold">${formatNumber(nextMileage)} km</span>
            <span class="text-[10px] text-slate-500 block">每 ${formatNumber(item.intervalKm)} km / ${escapeHtml(item.intervalMonths)}月</span>
          </div>
        </div>
        ${item.dueDate ? `<p class="text-[11px] text-slate-400 mt-2"><i class="fa-regular fa-calendar mr-1"></i>預計到期日 <span class="font-mono text-slate-300">${escapeHtml(item.dueDate)}</span></p>` : ''}
      </div>

      <!-- Card Actions -->
      <div class="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-slate-800">
        <div class="flex gap-2">
          <button data-action="edit-item" data-id="${escapeHtml(item.id)}" class="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition">
            <i class="fa-solid fa-gear mr-1"></i>設定
          </button>
          <button data-action="delete-item" data-id="${escapeHtml(item.id)}" class="text-xs text-slate-500 hover:text-rose-400 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition" title="刪除項目">
            <i class="fa-solid fa-trash-can"></i>
          </button>
          <a href="${escapeHtml(calendarUrl(vehicle, item, nextDateObj, nextMileage))}" target="_blank" rel="noopener" class="text-xs text-slate-400 hover:text-sky-300 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition" title="加入 Google 日曆">
            <i class="fa-regular fa-calendar-plus"></i>
          </a>
        </div>

        <button data-action="complete-item" data-id="${escapeHtml(item.id)}" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5">
          <i class="fa-solid fa-check-double"></i> 記錄更換
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  // Update Alert Badges
  document.getElementById('hero-alert-count').textContent = alertCount;
  const tabAlertBadge = document.getElementById('badge-tab-alert');
  tabAlertBadge.textContent = alertCount;
  if (alertCount === 0) {
    tabAlertBadge.classList.add('hidden');
  } else {
    tabAlertBadge.classList.remove('hidden');
  }
}
