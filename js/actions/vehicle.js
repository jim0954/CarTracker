// --- 車輛：切換、更新里程、新增/編輯/刪除 ---
import * as store from '../store.js';
import { formatNumber, showToast, openModal, closeModal, openConfirmModal } from '../utils.js';
import { renderApp } from '../render/app.js';

export function initVehicleActions() {
  // 快速更新里程
  document.getElementById('btn-quick-mileage').addEventListener('click', () => {
    const v = store.getCurrentVehicle();
    document.getElementById('input-new-mileage').value = v.currentMileage;
    openModal('modal-mileage');
  });

  document.getElementById('form-mileage').addEventListener('submit', (e) => {
    e.preventDefault();
    const newMileage = parseInt(document.getElementById('input-new-mileage').value, 10);
    const v = store.getCurrentVehicle();

    if (isNaN(newMileage) || newMileage < 0) {
      showToast('請輸入有效的里程數字', 'error');
      return;
    }

    store.updateMileage(v.id, newMileage);
    closeModal('modal-mileage');
    renderApp();
    showToast(`里程已成功更新為 ${formatNumber(newMileage)} km`);
  });

  // 切換車輛
  document.getElementById('vehicle-select').addEventListener('change', (e) => {
    store.setCurrentVehicle(e.target.value);
    renderApp();
    showToast(`已切換至 ${store.getCurrentVehicle().name}`);
  });

  // 開啟車輛管理
  document.getElementById('btn-open-vehicle-modal').addEventListener('click', () => {
    const v = store.getCurrentVehicle();
    document.getElementById('vehicle-modal-title').innerHTML = '<i class="fa-solid fa-car-side text-emerald-400"></i> 管理車輛資訊';
    document.getElementById('vehicle-edit-id').value = v.id;
    document.getElementById('vehicle-input-name').value = v.name;
    document.getElementById('vehicle-input-plate').value = v.plate;
    document.getElementById('vehicle-input-type').value = v.type;
    document.getElementById('vehicle-input-mileage').value = v.currentMileage;
    document.getElementById('vehicle-input-year').value = v.year;
    document.getElementById('vehicle-input-notes').value = v.notes || '';

    const delBtn = document.getElementById('btn-delete-vehicle');
    if (store.getVehicles().length > 1) {
      delBtn.classList.remove('hidden');
    } else {
      delBtn.classList.add('hidden');
    }

    openModal('modal-vehicle');
  });

  document.getElementById('form-vehicle').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('vehicle-edit-id').value;
    const name = document.getElementById('vehicle-input-name').value.trim();
    const plate = document.getElementById('vehicle-input-plate').value.trim();
    const type = document.getElementById('vehicle-input-type').value;
    const mileage = parseInt(document.getElementById('vehicle-input-mileage').value, 10) || 0;
    const year = parseInt(document.getElementById('vehicle-input-year').value, 10) || 2023;
    const notes = document.getElementById('vehicle-input-notes').value.trim();

    store.saveVehicle({ id: id || undefined, name, plate, type, currentMileage: mileage, year, notes });
    closeModal('modal-vehicle');
    renderApp();
    showToast('車輛資料已儲存！');
  });

  document.getElementById('btn-delete-vehicle').addEventListener('click', () => {
    const v = store.getCurrentVehicle();
    openConfirmModal('刪除車輛', `確定要刪除「${v.name} (${v.plate})」嗎？這將會一併移除該車的所有保養項目與紀錄！`, () => {
      store.deleteVehicle(v.id);
      closeModal('modal-vehicle');
      renderApp();
      showToast('車輛已刪除');
    });
  });
}
