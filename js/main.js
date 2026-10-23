// --- 程式進入點 ---
import { loadState } from './state.js';
import { initModals } from './utils.js';
import { renderApp } from './render/app.js';
import { initTabs } from './actions/tabs.js';
import { initVehicleActions } from './actions/vehicle.js';
import { initRecordActions, editRecord, deleteRecord } from './actions/record.js';
import { initItemActions, editMaintenanceItem, deleteMaintenanceItem, quickCompleteMaintenance } from './actions/item.js';
import { initBackupActions } from './actions/backup.js';

// 動態產生的卡片/表格按鈕以 data-action 委派處理
const delegatedActions = {
  'edit-item': editMaintenanceItem,
  'delete-item': deleteMaintenanceItem,
  'complete-item': quickCompleteMaintenance,
  'edit-record': editRecord,
  'delete-record': deleteRecord
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const handler = delegatedActions[btn.dataset.action];
  if (handler) handler(btn.dataset.id);
});

initModals();
initTabs();
initVehicleActions();
initRecordActions();
initItemActions();
initBackupActions();

loadState();
renderApp();
