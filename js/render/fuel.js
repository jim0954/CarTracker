// --- 分頁 3：加油與油耗 ---
import * as store from '../store.js';
import { formatNumber, formatDate, escapeHtml } from '../utils.js';

export function renderFuelTab(vehicle) {
  const fuelRecords = store.getRecords(vehicle.id)
    .filter(r => r.type === 'fuel')
    .sort((a, b) => a.mileage - b.mileage); // sort asc to compute intervals

  let totalFuelCost = 0;
  let totalLiters = 0;
  let calculatedIntervals = [];
  const intervalInfo = new Map(); // 記錄 id → 區間里程與油耗（不寫回資料）

  for (let i = 0; i < fuelRecords.length; i++) {
    const curr = fuelRecords[i];
    totalFuelCost += Number(curr.amount) || 0;
    const liters = curr.details ? Number(curr.details.liters) || 0 : 0;
    totalLiters += liters;

    let intervalDistance = null;
    let kmPerLiter = null;

    // Calculate economy between full tank records
    if (i > 0 && curr.details && curr.details.isFullTank && fuelRecords[i - 1].details && fuelRecords[i - 1].details.isFullTank) {
      intervalDistance = curr.mileage - fuelRecords[i - 1].mileage;
      if (intervalDistance > 0 && liters > 0) {
        kmPerLiter = (intervalDistance / liters).toFixed(1);
        calculatedIntervals.push({
          dist: intervalDistance,
          liters: liters,
          cost: Number(curr.amount) || 0
        });
      }
    }
    intervalInfo.set(curr.id, { dist: intervalDistance, kmPerLiter });
  }

  // Display stats
  let avgKmL = '0.0';
  let avgCostKm = '0.00';

  if (calculatedIntervals.length > 0) {
    const sumDist = calculatedIntervals.reduce((s, it) => s + it.dist, 0);
    const sumLiters = calculatedIntervals.reduce((s, it) => s + it.liters, 0);
    const sumCost = calculatedIntervals.reduce((s, it) => s + it.cost, 0);
    if (sumLiters > 0) avgKmL = (sumDist / sumLiters).toFixed(1);
    if (sumDist > 0) avgCostKm = (sumCost / sumDist).toFixed(2);
  }

  document.getElementById('fuel-stat-avg-kml').textContent = avgKmL;
  document.getElementById('fuel-stat-cost-km').textContent = avgCostKm;
  document.getElementById('fuel-stat-total-liters').textContent = totalLiters.toFixed(1);
  document.getElementById('fuel-stat-total-cost').textContent = formatNumber(totalFuelCost);

  // 一筆一列（新到舊），跟保養頁同樣的樣式：日期與油耗、金額公升里程；點一下展開明細與操作
  const list = document.getElementById('fuel-list');
  list.innerHTML = '';
  document.getElementById('fuel-empty-state').classList.toggle('hidden', fuelRecords.length > 0);

  const btn = 'flex-1 min-w-0 flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] whitespace-nowrap transition bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white';
  [...fuelRecords].reverse().forEach(r => {
    const d = r.details || {};
    const liters = Number(d.liters) || 0;
    const info = intervalInfo.get(r.id);

    const row = document.createElement('details');
    row.className = 'record-row';
    row.innerHTML = `
      <summary class="list-none px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition">
        <div class="flex items-center gap-2.5">
          <span class="w-2.5 h-2.5 shrink-0 rounded-full ${info.kmPerLiter ? 'bg-sky-500' : 'bg-slate-600'}"></span>
          <span class="font-semibold text-white font-mono flex-1">${escapeHtml(formatDate(r.date))}</span>
          <span class="shrink-0 text-xs font-bold ${info.kmPerLiter ? 'text-sky-400' : 'text-slate-500'}">${info.kmPerLiter ? `${info.kmPerLiter} km/L` : '—'}</span>
          <i class="record-chevron fa-solid fa-chevron-down text-[10px] text-slate-600 transition-transform"></i>
        </div>
        <div class="ml-5 mt-1.5 text-[11px] text-slate-500 font-mono">NT$ ${formatNumber(r.amount)} · ${liters.toFixed(2)} L · ${formatNumber(r.mileage)} km</div>
      </summary>
      <div class="px-4 pb-3 pl-9 text-xs text-slate-400 space-y-1">
        ${d.pricePerLiter ? `<p>單價：<span class="font-mono text-slate-300">$${escapeHtml(d.pricePerLiter)} / L</span></p>` : ''}
        ${info.dist ? `<p>區間行駛：<span class="font-mono text-slate-300">${formatNumber(info.dist)} km</span></p>` : ''}
        <p>${d.isFullTank ? '加滿跳停' : '未加滿'}</p>
        ${r.vendor ? `<p>${escapeHtml(r.vendor)}</p>` : ''}
        ${r.notes ? `<p class="whitespace-pre-line">${escapeHtml(r.notes)}</p>` : ''}
        <div class="flex gap-1.5 pt-2 -ml-5">
          <button data-action="edit-record" data-id="${escapeHtml(r.id)}" class="${btn}"><i class="fa-solid fa-pen"></i>編輯</button>
          <button data-action="delete-record" data-id="${escapeHtml(r.id)}" class="${btn} hover:text-rose-400"><i class="fa-solid fa-trash-can"></i>刪除</button>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
}
