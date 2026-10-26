// --- 保養項目：新增 / 編輯 / 刪除 / 新增更換紀錄 ---
import * as store from '../store.js';
import { showToast, openModal, closeModal, openConfirmModal, todayStr, formatNumber, escapeHtml } from '../utils.js';
import { renderApp } from '../render/app.js';
import { itemHistory } from '../render/maintenance.js';
import { openRecordModalForType, editRecord } from './record.js';

export function quickCompleteMaintenance(itemId) {
  const item = store.getItem(itemId);
  if (!item) return;

  openRecordModalForType('maintenance', '', [itemId]);
}

// 更換歷史：每次更換的日期、里程、間隔、店家、規格與金額；點一筆編輯該次紀錄
export function showItemHistory(itemId) {
  const item = store.getItem(itemId);
  if (!item) return;
  const history = itemHistory(item, store.getRecords(item.vehicleId));
  const gaps = history.map(h => h.gapKm).filter(g => g !== null);
  const total = history.reduce((sum, h) => sum + (h.part ? h.part.price : 0), 0);

  document.getElementById('item-history-title').textContent = `${item.name} 更換歷史`;
  document.getElementById('item-history-summary').textContent = [
    `共 ${history.length} 次`,
    gaps.length ? `平均間隔 ${formatNumber(Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length))} km` : '',
    total ? `合計 $${formatNumber(total)}` : ''
  ].filter(Boolean).join(' · ');

  const list = document.getElementById('item-history-list');
  list.innerHTML = history.length === 0 ? '<li class="py-3 text-slate-500 text-xs">尚無更換紀錄</li>' : history.map(({ record, part, gapKm }) => `
    <li>
      <button type="button" data-history-record="${escapeHtml(record.id)}" class="w-full text-left flex items-start justify-between gap-3 py-2.5 hover:bg-slate-700/40 rounded-lg px-1 transition">
        <div class="min-w-0">
          <span class="font-mono text-slate-200">${escapeHtml(record.date)} · ${formatNumber(record.mileage)} km</span>
          ${gapKm !== null ? `<span class="text-[11px] text-slate-500 ml-1 whitespace-nowrap">+${formatNumber(gapKm)} km</span>` : ''}
          <span class="block text-xs text-slate-500 truncate">${escapeHtml([record.vendor, part && part.spec].filter(Boolean).join(' · '))}</span>
        </div>
        <span class="shrink-0 font-mono text-slate-300">${part && part.price ? `$${formatNumber(part.price)}` : ''}</span>
      </button>
    </li>`).join('');
  openModal('modal-item-history');
}

export function editMaintenanceItem(itemId) {
  const item = store.getItem(itemId);
  if (!item) return;

  document.getElementById('item-modal-title').innerHTML = '<i class="fa-solid fa-gear text-emerald-400"></i> 編輯保養項目週期';
  document.getElementById('item-edit-id').value = item.id;
  document.getElementById('item-input-name').value = item.name;
  document.getElementById('item-input-interval-km').value = item.intervalKm || '';
  document.getElementById('item-input-interval-months').value = item.intervalMonths || '';
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
  document.getElementById('item-history-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-history-record]');
    if (!btn) return;
    closeModal('modal-item-history');
    editRecord(btn.dataset.historyRecord);
  });

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
    // 里程與月數可只填一個，空白存成 0
    const intervalKm = parseInt(document.getElementById('item-input-interval-km').value, 10) || 0;
    const intervalMonths = parseInt(document.getElementById('item-input-interval-months').value, 10) || 0;
    const lastKm = parseInt(document.getElementById('item-input-last-km').value, 10) || 0;
    const lastDate = document.getElementById('item-input-last-date').value;
    const notes = document.getElementById('item-input-notes').value.trim();

    if (!intervalKm && !intervalMonths) {
      showToast('週期里程與週期月數至少要填一個', 'error');
      return;
    }

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
