// --- 用車紀錄：記一筆 / 編輯 / 刪除 ---
import * as store from '../store.js';
import { showToast, openModal, closeModal, openConfirmModal, todayStr, escapeHtml } from '../utils.js';
import { renderApp } from '../render/app.js';
import { renderRecordsTab } from '../render/records.js';

function populateRecordMaintenanceCheckboxes(vehicle, selectedIds = []) {
  const container = document.getElementById('record-maintenance-checkboxes');
  container.innerHTML = '';
  const items = store.getItems(vehicle.id);

  if (items.length === 0) {
    container.innerHTML = '<span class="text-slate-500">尚無自訂保養項目</span>';
    return;
  }

  items.forEach(it => {
    const lbl = document.createElement('label');
    lbl.className = 'flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 cursor-pointer transition';
    const isChecked = selectedIds.includes(it.id);
    lbl.innerHTML = `
      <input type="checkbox" name="maint-item-check" value="${escapeHtml(it.id)}" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-900 border-slate-700">
      <span class="truncate">${escapeHtml(it.name)}</span>
    `;
    container.appendChild(lbl);
  });
}

function toggleRecordTypeSections(type) {
  const secMaint = document.getElementById('section-maintenance-items');
  const secFuel = document.getElementById('section-fuel-inputs');

  if (type === 'maintenance') {
    secMaint.classList.remove('hidden');
    secFuel.classList.add('hidden');
  } else if (type === 'fuel') {
    secMaint.classList.add('hidden');
    secFuel.classList.remove('hidden');
  } else {
    secMaint.classList.add('hidden');
    secFuel.classList.add('hidden');
  }
}

export function openRecordModalForType(type, prefillTitle = '', prefillItemIds = []) {
  const v = store.getCurrentVehicle();
  document.getElementById('record-modal-title').innerHTML = '<i class="fa-solid fa-pen-nib text-emerald-400"></i> 新增用車紀錄';
  document.getElementById('record-edit-id').value = '';
  document.getElementById('record-input-date').value = todayStr();
  document.getElementById('record-input-mileage').value = v.currentMileage;
  document.getElementById('record-input-title').value = prefillTitle || (type === 'fuel' ? '加滿 95 無鉛汽油' : '');
  document.getElementById('record-input-amount').value = '';
  document.getElementById('record-input-vendor').value = '';
  document.getElementById('record-input-notes').value = '';
  document.getElementById('fuel-input-liters').value = '';
  document.getElementById('fuel-input-unit-price').value = '31.5';
  document.getElementById('fuel-input-full').checked = true;

  const radio = document.querySelector(`input[name="record-type"][value="${type}"]`);
  if (radio) radio.checked = true;
  toggleRecordTypeSections(type);

  populateRecordMaintenanceCheckboxes(v, prefillItemIds);
  openModal('modal-record');
}

export function editRecord(recordId) {
  const rec = store.getRecord(recordId);
  if (!rec) return;

  const v = store.getCurrentVehicle();
  document.getElementById('record-modal-title').innerHTML = '<i class="fa-solid fa-pen-to-square text-emerald-400"></i> 編輯用車紀錄';
  document.getElementById('record-edit-id').value = rec.id;
  document.getElementById('record-input-date').value = rec.date;
  document.getElementById('record-input-mileage').value = rec.mileage;
  document.getElementById('record-input-title').value = rec.title;
  document.getElementById('record-input-amount').value = rec.amount;
  document.getElementById('record-input-vendor').value = rec.vendor || '';
  document.getElementById('record-input-notes').value = rec.notes || '';

  const radio = document.querySelector(`input[name="record-type"][value="${rec.type}"]`);
  if (radio) radio.checked = true;
  toggleRecordTypeSections(rec.type);

  const itemIds = rec.details && rec.details.itemIds ? rec.details.itemIds : [];
  populateRecordMaintenanceCheckboxes(v, itemIds);

  if (rec.type === 'fuel' && rec.details) {
    document.getElementById('fuel-input-liters').value = rec.details.liters || '';
    document.getElementById('fuel-input-unit-price').value = rec.details.pricePerLiter || '';
    document.getElementById('fuel-input-full').checked = !!rec.details.isFullTank;
  }

  openModal('modal-record');
}

export function deleteRecord(recordId) {
  openConfirmModal('刪除紀錄', '確定要刪除這筆用車紀錄嗎？刪除後無法還原。', () => {
    store.deleteRecord(recordId);
    renderApp();
    showToast('紀錄已刪除');
  });
}

// 依公升數與單價自動計算金額
function autoCalcGasAmount() {
  const liters = parseFloat(document.getElementById('fuel-input-liters').value) || 0;
  const price = parseFloat(document.getElementById('fuel-input-unit-price').value) || 0;
  if (liters > 0 && price > 0) {
    document.getElementById('record-input-amount').value = Math.round(liters * price);
  }
}

export function initRecordActions() {
  document.querySelectorAll('input[name="record-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      toggleRecordTypeSections(e.target.value);
    });
  });

  document.getElementById('btn-open-record-modal').addEventListener('click', () => {
    openRecordModalForType('maintenance');
  });

  document.getElementById('btn-quick-fuel').addEventListener('click', () => {
    openRecordModalForType('fuel');
  });

  document.getElementById('fuel-input-liters').addEventListener('input', autoCalcGasAmount);
  document.getElementById('fuel-input-unit-price').addEventListener('input', autoCalcGasAmount);

  document.getElementById('form-record').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = store.getCurrentVehicle();
    const editId = document.getElementById('record-edit-id').value;
    const type = document.querySelector('input[name="record-type"]:checked').value;
    const date = document.getElementById('record-input-date').value;
    const mileage = parseInt(document.getElementById('record-input-mileage').value, 10);
    const title = document.getElementById('record-input-title').value.trim();
    const amount = parseFloat(document.getElementById('record-input-amount').value) || 0;
    const vendor = document.getElementById('record-input-vendor').value.trim();
    const notes = document.getElementById('record-input-notes').value.trim();

    const checkedItemIds = [];
    if (type === 'maintenance') {
      document.querySelectorAll('input[name="maint-item-check"]:checked').forEach(cb => {
        checkedItemIds.push(cb.value);
      });
    }

    let details = {};
    if (type === 'fuel') {
      details = {
        liters: parseFloat(document.getElementById('fuel-input-liters').value) || 0,
        pricePerLiter: parseFloat(document.getElementById('fuel-input-unit-price').value) || 0,
        isFullTank: document.getElementById('fuel-input-full').checked
      };
    } else if (type === 'maintenance') {
      details = { itemIds: checkedItemIds };
    }

    if (editId) {
      store.saveRecord({ id: editId, date, mileage, type, title, amount, vendor, notes, details });
    } else {
      store.saveRecord({ vehicleId: v.id, date, mileage, type, title, amount, vendor, notes, details });
    }

    closeModal('modal-record');
    renderApp();
    showToast('用車紀錄已儲存！');
  });

  // 搜尋與篩選
  document.getElementById('record-search-input').addEventListener('input', () => {
    renderRecordsTab(store.getCurrentVehicle());
  });
  document.getElementById('record-filter-type').addEventListener('change', () => {
    renderRecordsTab(store.getCurrentVehicle());
  });
}
