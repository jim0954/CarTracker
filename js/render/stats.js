// --- 分頁 4：費用統計圖表 ---
import * as store from '../store.js';
import { formatNumber } from '../utils.js';
import { themeColor } from '../theme.js';

let monthlyCostChartInstance = null;
let categoryPieChartInstance = null;

export function renderStatsTab(vehicle) {
  const records = store.getRecords(vehicle.id);

  // Breakdown sums
  let maintCost = 0, maintCount = 0;
  let fuelCost = 0, fuelCount = 0;
  let taxCost = 0;
  let otherCost = 0;

  records.forEach(r => {
    const amt = Number(r.amount) || 0;
    if (r.type === 'maintenance') {
      maintCost += amt;
      maintCount++;
    } else if (r.type === 'fuel') {
      fuelCost += amt;
      fuelCount++;
    } else if (r.type === 'tax') {
      taxCost += amt;
    } else {
      otherCost += amt;
    }
  });

  const totalCost = maintCost + fuelCost + taxCost + otherCost;
  const totalKmDriven = vehicle.currentMileage - (vehicle.initialMileage || 0);
  const costPerKm = totalKmDriven > 0 ? (totalCost / totalKmDriven).toFixed(2) : '0.00';

  document.getElementById('stat-maintenance-cost').textContent = `NT$ ${formatNumber(maintCost)}`;
  document.getElementById('stat-maintenance-count').textContent = `共 ${maintCount} 筆保養紀錄`;
  document.getElementById('stat-fuel-cost').textContent = `NT$ ${formatNumber(fuelCost)}`;
  document.getElementById('stat-fuel-count').textContent = `共 ${fuelCount} 次加油紀錄`;
  document.getElementById('stat-tax-cost').textContent = `NT$ ${formatNumber(taxCost)}`;
  document.getElementById('stat-cost-per-km').textContent = `${costPerKm} 元/km`;

  // 1. Monthly Cost Stacked Bar Chart
  // Generate last 6 months keys
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }

  const monthlyMaint = months.map(() => 0);
  const monthlyFuel = months.map(() => 0);
  const monthlyOther = months.map(() => 0);

  records.forEach(r => {
    if (!r.date) return;
    const ym = r.date.substring(0, 7);
    const idx = months.indexOf(ym);
    if (idx !== -1) {
      const amt = Number(r.amount) || 0;
      if (r.type === 'maintenance') monthlyMaint[idx] += amt;
      else if (r.type === 'fuel') monthlyFuel[idx] += amt;
      else monthlyOther[idx] += amt;
    }
  });

  const barCtx = document.getElementById('monthlyCostChart');
  if (monthlyCostChartInstance) monthlyCostChartInstance.destroy();

  monthlyCostChartInstance = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.replace('-', '/')),
      datasets: [
        { label: '保養維修', data: monthlyMaint, backgroundColor: themeColor('emerald-500'), borderRadius: 4 },
        { label: '加油燃料', data: monthlyFuel, backgroundColor: themeColor('sky-600'), borderRadius: 4 },
        { label: '其他/稅費', data: monthlyOther, backgroundColor: themeColor('violet-500'), borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { color: themeColor('slate-700', 0.4) }, ticks: { color: themeColor('slate-400') } },
        y: { stacked: true, grid: { color: themeColor('slate-700', 0.4) }, ticks: { color: themeColor('slate-400') } }
      },
      plugins: {
        legend: { labels: { color: themeColor('slate-300'), font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: NT$ ${formatNumber(context.raw)}`;
            }
          }
        }
      }
    }
  });

  // 2. Category Doughnut Chart
  const pieCtx = document.getElementById('categoryPieChart');
  if (categoryPieChartInstance) categoryPieChartInstance.destroy();

  categoryPieChartInstance = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: ['保養維修', '加油燃料', '稅費保險', '改裝其他'],
      datasets: [{
        data: [maintCost, fuelCost, taxCost, otherCost],
        backgroundColor: ['emerald-500', 'sky-600', 'indigo-500', 'amber-500'].map(c => themeColor(c)),
        borderWidth: 2,
        borderColor: themeColor('slate-800')
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: themeColor('slate-300'), font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              const pct = totalCost > 0 ? Math.round((val / totalCost) * 100) : 0;
              return ` ${context.label}: NT$ ${formatNumber(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}
