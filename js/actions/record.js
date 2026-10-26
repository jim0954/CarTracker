// --- 用車紀錄：記一筆 / 編輯 / 刪除 ---
import * as store from '../store.js';
import { showToast, openModal, closeModal, openConfirmModal, todayStr } from '../utils.js';
import { renderApp } from '../render/app.js';
import { renderRecordsTab } from '../render/records.js';
import { recordParts } from '../parts.js';

// --- 保養項目明細編輯 ---
const inputCls = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none';

function partRows() {
  return [...document.querySelectorAll('#record-parts .part-row')];
}

function readParts() {
  return partRows()
    .map(row => ({
      name: row.querySelector('.part-name').value.trim(),
      spec: row.querySelector('.part-spec').value.trim(),
      price: parseFloat(row.querySelector('.part-price').value) || 0
    }))
    .filter(p => p.name);
}

// 項目金額變動時，總額改為各項加總
function syncAmountFromParts() {
  const total = readParts().reduce((sum, p) => sum + p.price, 0);
  if (total > 0) document.getElementById('record-input-amount').value = Math.round(total * 100) / 100;
}

function refreshChips() {
  const names = new Set(readParts().map(p => p.name));
  document.querySelectorAll('#record-item-chips button').forEach(chip => {
    const active = names.has(chip.dataset.name);
    chip.className = `px-2.5 py-1 rounded-full text-xs border transition ${active
      ? 'bg-emerald-600 border-emerald-500 text-white'
      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`;
  });
}

function addPartRow(part = {}) {
  const row = document.createElement('div');
  row.className = 'part-row bg-slate-800/60 rounded-lg p-2 flex flex-col gap-1.5';
  row.innerHTML = `
    <div class="flex gap-1.5">
      <input type="text" class="part-name ${inputCls} flex-1 min-w-0 text-sm" placeholder="項目名稱">
      <input type="number" inputmode="decimal" min="0" step="any" class="part-price ${inputCls} w-24 text-sm font-mono" placeholder="金額">
      <button type="button" class="part-remove px-2 text-slate-500 hover:text-rose-400" title="移除"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <input type="text" class="part-spec ${inputCls} text-xs" placeholder="規格 / 說明（選填）">
  `;
  row.querySelector('.part-name').value = part.name || '';
  row.querySelector('.part-spec').value = part.spec || '';
  row.querySelector('.part-price').value = part.price ? part.price : '';
  row.querySelector('.part-remove').addEventListener('click', () => {
    row.remove();
    syncAmountFromParts();
    refreshChips();
  });
  row.querySelector('.part-price').addEventListener('input', syncAmountFromParts);
  row.querySelector('.part-name').addEventListener('input', refreshChips);
  document.getElementById('record-parts').appendChild(row);
  return row;
}

// 點保養項目標籤：未加入就新增一列，已加入就移除
function toggleItemPart(name) {
  const existing = partRows().find(row => row.querySelector('.part-name').value.trim() === name);
  if (existing) {
    existing.remove();
    syncAmountFromParts();
  } else {
    addPartRow({ name }).querySelector('.part-price').focus();
  }
  refreshChips();
}

function populateParts(vehicle, parts) {
  const chips = document.getElementById('record-item-chips');
  chips.innerHTML = '';
  store.getItems(vehicle.id).forEach(it => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.name = it.name;
    chip.textContent = it.name;
    chip.addEventListener('click', () => toggleItemPart(it.name));
    chips.appendChild(chip);
  });
  document.getElementById('record-parts').innerHTML = '';
  parts.forEach(p => addPartRow(p));
  refreshChips();
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

  const prefillParts = prefillItemIds.map(id => store.getItem(id)).filter(Boolean).map(it => ({ name: it.name }));
  populateParts(v, prefillParts);
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
  const { parts, notes } = recordParts(rec);
  document.getElementById('record-input-notes').value = notes;

  const radio = document.querySelector(`input[name="record-type"][value="${rec.type}"]`);
  if (radio) radio.checked = true;
  toggleRecordTypeSections(rec.type);

  populateParts(v, parts);

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

  ['btn-open-record-modal', 'btn-fab-record'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => openRecordModalForType('maintenance'));
  });

  document.getElementById('btn-quick-fuel').addEventListener('click', () => {
    openRecordModalForType('fuel');
  });

  document.getElementById('fuel-input-liters').addEventListener('input', autoCalcGasAmount);
  document.getElementById('fuel-input-unit-price').addEventListener('input', autoCalcGasAmount);
  document.getElementById('btn-add-part').addEventListener('click', () => {
    addPartRow().querySelector('.part-name').focus();
  });

  document.getElementById('form-record').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = store.getCurrentVehicle();
    const editId = document.getElementById('record-edit-id').value;
    const type = document.querySelector('input[name="record-type"]:checked').value;
    const date = document.getElementById('record-input-date').value;
    const mileage = parseInt(document.getElementById('record-input-mileage').value, 10);
    let title = document.getElementById('record-input-title').value.trim();
    const amount = parseFloat(document.getElementById('record-input-amount').value) || 0;
    const vendor = document.getElementById('record-input-vendor').value.trim();
    const notes = document.getElementById('record-input-notes').value.trim();

    const parts = type === 'maintenance' ? readParts() : [];
    if (!title) title = parts.map(p => p.name).join('、');
    if (!title) {
      showToast('請填寫名稱，或加入至少一個保養項目', 'error');
      return;
    }

    let details = {};
    if (type === 'fuel') {
      details = {
        liters: parseFloat(document.getElementById('fuel-input-liters').value) || 0,
        pricePerLiter: parseFloat(document.getElementById('fuel-input-unit-price').value) || 0,
        isFullTank: document.getElementById('fuel-input-full').checked
      };
    } else if (type === 'maintenance') {
      // 與保養項目同名的明細，儲存時會更新該項目的上次更換
      const names = new Set(parts.map(p => p.name));
      const itemIds = store.getItems(v.id).filter(it => names.has(it.name)).map(it => it.id);
      details = { itemIds, parts };
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
