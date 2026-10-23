// --- 整體畫面（車輛選單、Hero 區塊）---
import * as store from '../store.js';
import { formatNumber } from '../utils.js';
import { renderMaintenanceTab } from './maintenance.js';
import { renderRecordsTab } from './records.js';
import { renderFuelTab } from './fuel.js';
import { renderStatsTab } from './stats.js';

export function renderApp() {
  const vehicle = store.getCurrentVehicle();
  if (!vehicle) return;

  // 1. 車輛下拉選單
  const select = document.getElementById('vehicle-select');
  select.innerHTML = '';
  store.getVehicles().forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.name} (${v.plate})`;
    if (v.id === vehicle.id) opt.selected = true;
    select.appendChild(opt);
  });

  // 2. Hero 車輛資訊
  document.getElementById('vehicle-title').textContent = vehicle.name;
  document.getElementById('vehicle-plate').textContent = vehicle.plate;
  document.getElementById('vehicle-year').textContent = `${vehicle.year} 年式`;
  document.getElementById('vehicle-notes').textContent = vehicle.notes || '隨時掌握保養與里程';

  const typeBadge = document.getElementById('vehicle-badge-type');
  if (vehicle.type === 'moto') {
    typeBadge.innerHTML = '<i class="fa-solid fa-motorcycle mr-1"></i>機車';
    typeBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  } else {
    typeBadge.innerHTML = '<i class="fa-solid fa-car mr-1"></i>汽車';
    typeBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30';
  }

  document.getElementById('hero-current-mileage').textContent = formatNumber(vehicle.currentMileage);
  document.getElementById('current-mileage-label').textContent = formatNumber(vehicle.currentMileage);

  // 該車累計花費
  const vehicleRecords = store.getRecords(vehicle.id);
  const totalCost = vehicleRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  document.getElementById('hero-total-cost').textContent = formatNumber(totalCost);

  renderMaintenanceTab(vehicle);
  renderRecordsTab(vehicle);
  renderFuelTab(vehicle);
  renderStatsTab(vehicle);
}
