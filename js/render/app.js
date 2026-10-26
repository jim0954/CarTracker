// --- 整體畫面（車輛選單、車輛摘要列）---
import * as store from '../store.js';
import { formatNumber } from '../utils.js';
import { renderMaintenanceTab } from './maintenance.js';
import { renderRecordsTab } from './records.js';
import { renderFuelTab } from './fuel.js';
import { renderStatsTab } from './stats.js';

export function renderApp() {
  const vehicle = store.getCurrentVehicle();

  // 尚未建立車輛時只顯示歡迎畫面
  const isEmpty = !vehicle;
  document.getElementById('empty-welcome').classList.toggle('hidden', !isEmpty);
  ['hero-section', 'main-content', 'vehicle-select-wrap', 'btn-quick-mileage', 'mobile-nav', 'btn-fab-record'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', isEmpty);
  });
  if (isEmpty) return;

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

  // 2. 車輛摘要列
  const typeBadge = document.getElementById('vehicle-badge-type');
  const isMoto = vehicle.type === 'moto';
  typeBadge.innerHTML = `<i class="fa-solid ${isMoto ? 'fa-motorcycle' : 'fa-car'}"></i>`;
  typeBadge.title = isMoto ? '機車' : '汽車';
  typeBadge.className = `w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm ${isMoto
    ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'}`;

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
