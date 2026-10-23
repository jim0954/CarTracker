// --- 分頁 2：用車紀錄 ---
import * as store from '../store.js';
import { formatNumber, formatDate } from '../utils.js';

export function renderRecordsTab(vehicle) {
  const tbody = document.getElementById('records-table-body');
  const emptyState = document.getElementById('records-empty-state');
  tbody.innerHTML = '';

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

  records.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';

    let badgeType = '';
    if (r.type === 'maintenance') {
      badgeType = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">保養維修</span>';
    } else if (r.type === 'fuel') {
      badgeType = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">加油</span>';
    } else if (r.type === 'tax') {
      badgeType = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">稅費保險</span>';
    } else {
      badgeType = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">其他</span>';
    }

    let detailExtra = '';
    if (r.type === 'fuel' && r.details && r.details.liters) {
      detailExtra = `<span class="text-[10px] text-sky-400 block">${r.details.liters} L @ $${r.details.pricePerLiter || ''}</span>`;
    }

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono text-xs text-slate-300">${formatDate(r.date)}</td>
      <td class="py-3 px-4">${badgeType}</td>
      <td class="py-3 px-4 font-mono text-slate-200">${formatNumber(r.mileage)}</td>
      <td class="py-3 px-4">
        <span class="font-medium text-white block">${r.title}</span>
        ${detailExtra}
      </td>
      <td class="py-3 px-4 text-right font-mono font-bold text-slate-200">NT$ ${formatNumber(r.amount)}</td>
      <td class="py-3 px-4 text-xs text-slate-400">
        <span class="text-slate-300 block">${r.vendor || '-'}</span>
        <span class="text-[11px] text-slate-500">${r.notes || ''}</span>
      </td>
      <td class="py-3 px-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <button data-action="edit-record" data-id="${r.id}" class="text-slate-400 hover:text-white p-1 rounded" title="編輯"><i class="fa-solid fa-pen"></i></button>
          <button data-action="delete-record" data-id="${r.id}" class="text-slate-500 hover:text-rose-400 p-1 rounded" title="刪除"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}
