// --- 保養項目：新增 / 編輯 / 刪除 / 記錄更換 ---
import * as store from '../store.js';
import { showToast, openModal, closeModal, openConfirmModal, todayStr } from '../utils.js';
import { renderApp } from '../render/app.js';
import { openRecordModalForType } from './record.js';

export function quickCompleteMaintenance(itemId) {
  const item = store.getItem(itemId);
  if (!item) return;

  openRecordModalForType('maintenance', `更換 ${item.name}`, [itemId]);
}

export function editMaintenanceItem(itemId) {
  const item = store.getItem(itemId);
  if (!item) return;

  document.getElementById('item-modal-title').innerHTML = '<i class="fa-solid fa-gear text-emerald-400"></i> 編輯保養項目週期';
  document.getElementById('item-edit-id').value = item.id;
  document.getElementById('item-input-name').value = item.name;
  document.getElementById('item-input-interval-km').value = item.intervalKm;
  document.getElementById('item-input-interval-months').value = item.intervalMonths || 6;
  document.getElementById('item-input-last-km').value = item.lastKm;
  document.getElementById('item-input-last-date').value = item.lastDate || '';
  document.getElementById('item-input-notes').value = item.notes || '';
  openModal('modal-item');
}

export function deleteMaintenanceItem(itemId) {
  const item = store.getItem(itemId);
  if (!item) return;

  openConfirmModal('刪除保養項目', `確定要刪除「${item.name}」嗎？`, () => {
    store.deleteItem(itemId);
    renderApp();
    showToast('保養項目已移除');
  });
}

export function initItemActions() {
  document.getElementById('btn-add-maintenance-item').addEventListener('click', () => {
    const v = store.getCurrentVehicle();
    document.getElementById('item-modal-title').innerHTML = '<i class="fa-solid fa-plus text-emerald-400"></i> 新增自訂保養項目';
    document.getElementById('item-edit-id').value = '';
    document.getElementById('item-input-name').value = '';
    document.getElementById('item-input-interval-km').value = '5000';
    document.getElementById('item-input-interval-months').value = '6';
    document.getElementById('item-input-last-km').value = v.currentMileage;
    document.getElementById('item-input-last-date').value = todayStr();
    document.getElementById('item-input-notes').value = '';
    openModal('modal-item');
  });

  document.getElementById('form-item').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = store.getCurrentVehicle();
    const editId = document.getElementById('item-edit-id').value;
    const name = document.getElementById('item-input-name').value.trim();
    const intervalKm = parseInt(document.getElementById('item-input-interval-km').value, 10);
    const intervalMonths = parseInt(document.getElementById('item-input-interval-months').value, 10) || 6;
    const lastKm = parseInt(document.getElementById('item-input-last-km').value, 10) || 0;
    const lastDate = document.getElementById('item-input-last-date').value;
    const notes = document.getElementById('item-input-notes').value.trim();

    if (editId) {
      store.saveItem({ id: editId, name, intervalKm, intervalMonths, lastKm, lastDate, notes });
    } else {
      store.saveItem({ vehicleId: v.id, name, intervalKm, intervalMonths, lastKm, lastDate, notes });
    }

    closeModal('modal-item');
    renderApp();
    showToast('保養項目已儲存！');
  });
}
