// --- 分頁 3：加油與油耗 ---
import { appState } from '../state.js';
import { formatNumber, formatDate } from '../utils.js';

export function renderFuelTab(vehicle) {
  const fuelRecords = appState.records
    .filter(r => r.vehicleId === vehicle.id && r.type === 'fuel')
    .sort((a, b) => a.mileage - b.mileage); // sort asc to compute intervals

  const tbody = document.getElementById('fuel-table-body');
  tbody.innerHTML = '';

  let totalFuelCost = 0;
  let totalLiters = 0;
  let calculatedIntervals = [];

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
    curr._intervalDist = intervalDistance;
    curr._kmPerLiter = kmPerLiter;
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

  // Render rows (sorted latest first)
  const displayFuel = [...fuelRecords].reverse();
  displayFuel.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';

    const liters = r.details ? (Number(r.details.liters) || 0).toFixed(2) : '-';
    const price = r.details && r.details.pricePerLiter ? r.details.pricePerLiter : '-';
    const distStr = r._intervalDist ? `${formatNumber(r._intervalDist)} km` : '-';
    const kmlBadge = r._kmPerLiter 
      ? `<span class="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">${r._kmPerLiter} km/L</span>`
      : '<span class="text-slate-600 text-xs">-</span>';

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono text-xs text-slate-300">${formatDate(r.date)}</td>
      <td class="py-3 px-4 font-mono text-slate-200">${formatNumber(r.mileage)}</td>
      <td class="py-3 px-4 font-mono text-xs text-slate-400">${distStr}</td>
      <td class="py-3 px-4 font-mono text-slate-200">${liters}</td>
      <td class="py-3 px-4 font-mono text-xs text-slate-400">${price}</td>
      <td class="py-3 px-4 text-right font-mono font-bold text-slate-200">NT$ ${formatNumber(r.amount)}</td>
      <td class="py-3 px-4 text-center">${kmlBadge}</td>
      <td class="py-3 px-4 text-xs text-slate-400">${r.vendor || ''} ${r.notes ? '(' + r.notes + ')' : ''}</td>
    `;
    tbody.appendChild(tr);
  });
}
