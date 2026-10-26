// --- 分頁 2：用車紀錄 ---
import * as store from '../store.js';
import { formatNumber, formatDate, escapeHtml } from '../utils.js';
import { recordParts } from '../parts.js';

const TYPE_STYLE = {
  maintenance: { label: '保養維修', icon: 'fa-screwdriver-wrench', color: 'bg-emerald-500/15 text-emerald-400' },
  fuel: { label: '加油', icon: 'fa-gas-pump', color: 'bg-sky-500/15 text-sky-400' },
  tax: { label: '稅費保險', icon: 'fa-file-invoice-dollar', color: 'bg-indigo-500/15 text-indigo-400' },
  other: { label: '其他', icon: 'fa-receipt', color: 'bg-amber-500/15 text-amber-400' }
};

// 列表只顯示重點（店家或標題、日期里程、一行摘要），點一下展開完整備註與操作
function recordRow(r) {
  const style = TYPE_STYLE[r.type] || TYPE_STYLE.other;
  const fuel = r.type === 'fuel' && r.details && r.details.liters
    ? `${r.details.liters} L @ $${r.details.pricePerLiter}` : '';
  // 保養有店家時以店家為標題、更換項目為摘要（同愛車99）；其他類型以標題為主
  const useVendor = r.type === 'maintenance' && r.vendor;
  const heading = useVendor ? r.vendor : r.title;
  const summary = useVendor ? r.title : (fuel || r.vendor || '');
  const { parts, notes } = recordParts(r);

  const row = document.createElement('details');
  row.className = 'record-row group';
  row.innerHTML = `
    <summary class="list-none flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition">
      <div class="w-9 h-9 shrink-0 rounded-full ${style.color} flex items-center justify-center text-sm" title="${style.label}">
        <i class="fa-solid ${style.icon}"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-3">
          <span class="font-semibold text-white truncate">${escapeHtml(heading) || style.label}</span>
          <span class="shrink-0 font-mono font-bold text-slate-200 text-sm">NT$ ${formatNumber(r.amount)}</span>
        </div>
        <div class="text-xs text-slate-400 font-mono mt-0.5">${escapeHtml(formatDate(r.date))} · ${formatNumber(r.mileage)} km</div>
        ${summary ? `<div class="text-xs text-slate-500 truncate mt-0.5">${escapeHtml(summary)}</div>` : ''}
      </div>
      <i class="record-chevron fa-solid fa-chevron-down text-[10px] text-slate-600 transition-transform"></i>
    </summary>
    <div class="px-4 pb-3 pl-16 text-xs text-slate-400 space-y-1">
      ${parts.length ? `<ul class="divide-y divide-slate-800/80">${parts.map(p => `
        <li class="flex items-start justify-between gap-3 py-1.5">
          <div class="min-w-0">
            <span class="text-slate-200">${escapeHtml(p.name)}</span>
            ${p.spec ? `<span class="block text-[11px] text-slate-500 whitespace-pre-line">${escapeHtml(p.spec)}</span>` : ''}
          </div>
          <span class="shrink-0 font-mono text-slate-300">${p.price ? `$${formatNumber(p.price)}` : ''}</span>
        </li>`).join('')}</ul>` : (useVendor ? `<p class="text-slate-300">${escapeHtml(r.title)}</p>` : '')}
      ${notes ? `<p class="whitespace-pre-line">${escapeHtml(notes)}</p>` : ''}
      <div class="flex gap-2 pt-2">
        <button data-action="edit-record" data-id="${escapeHtml(r.id)}" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"><i class="fa-solid fa-pen mr-1"></i>編輯</button>
        <button data-action="delete-record" data-id="${escapeHtml(r.id)}" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"><i class="fa-solid fa-trash-can mr-1"></i>刪除</button>
      </div>
    </div>
  `;
  return row;
}

export function renderRecordsTab(vehicle) {
  const list = document.getElementById('records-list');
  const emptyState = document.getElementById('records-empty-state');
  list.innerHTML = '';

  const searchKeyword = (document.getElementById('record-search-input').value || '').trim().toLowerCase();
  const filterType = document.getElementById('record-filter-type').value;

  let records = store.getRecords(vehicle.id);

  // Apply type filter
  if (filterType !== 'all') {
    records = records.filter(r => r.type === filterType);
  }

  // Apply search filter
  if (searchKeyword) {
    records = records.filter(r =>
      (r.title && r.title.toLowerCase().includes(searchKeyword)) ||
      (r.vendor && r.vendor.toLowerCase().includes(searchKeyword)) ||
      (r.notes && r.notes.toLowerCase().includes(searchKeyword))
    );
  }

  // Sort by date desc, mileage desc
  records.sort((a, b) => new Date(b.date) - new Date(a.date) || b.mileage - a.mileage);

  if (records.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  records.forEach(r => list.appendChild(recordRow(r)));
}
