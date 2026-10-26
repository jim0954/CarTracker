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

  // 一筆一列（新到舊）：日期里程、公升與單價、區間里程；右側金額與油耗；點一下編輯
  const list = document.getElementById('fuel-list');
  list.innerHTML = '';
  document.getElementById('fuel-empty-state').classList.toggle('hidden', fuelRecords.length > 0);

  [...fuelRecords].reverse().forEach(r => {
    const liters = r.details ? Number(r.details.liters) || 0 : 0;
    const price = r.details && r.details.pricePerLiter ? r.details.pricePerLiter : '';
    const info = intervalInfo.get(r.id);
    const detail = [
      liters ? `${liters.toFixed(2)} L${price ? ` × $${price}` : ''}` : '',
      info.dist ? `+${formatNumber(info.dist)} km` : '',
      r.vendor || ''
    ].filter(Boolean).join(' · ');

    const row = document.createElement('button');
    row.type = 'button';
    row.dataset.action = 'edit-record';
    row.dataset.id = r.id;
    row.className = 'w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition';
    row.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-mono text-sm text-slate-200">${escapeHtml(formatDate(r.date))} · ${formatNumber(r.mileage)} km</div>
        <div class="text-xs text-slate-500 truncate mt-0.5">${escapeHtml(detail)}${r.notes ? ` · ${escapeHtml(r.notes)}` : ''}</div>
      </div>
      <div class="shrink-0 text-right">
        <div class="font-mono font-bold text-sm text-slate-200">NT$ ${formatNumber(r.amount)}</div>
        <div class="text-xs font-mono ${info.kmPerLiter ? 'text-emerald-400' : 'text-slate-600'}">${info.kmPerLiter ? `${info.kmPerLiter} km/L` : (r.details && r.details.isFullTank ? '加滿' : '未加滿')}</div>
      </div>
    `;
    list.appendChild(row);
  });
}
