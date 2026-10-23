// --- 程式進入點 ---
import * as store from './store.js';
import { isCloudMode } from './config.js';
import { AUTH_ERROR_CODES } from './api.js';
import { startSession, showLogin, showLoading, hideLoading } from './session.js';
import { initModals, showToast } from './utils.js';
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

function handleCloudError(err) {
  if (AUTH_ERROR_CODES.includes(err.code)) showLogin(err.message);
  else showToast(err.message, 'error');
}

function updateSyncIndicator({ pending, error }) {
  const btn = document.getElementById('btn-sync');
  const icon = document.getElementById('sync-icon');
  if (pending > 0) {
    icon.className = 'fa-solid fa-circle-notch fa-spin text-emerald-400';
    btn.title = '同步中…';
  } else if (error) {
    icon.className = 'fa-solid fa-triangle-exclamation text-rose-400';
    btn.title = '同步失敗，點擊重新載入';
  } else {
    icon.className = 'fa-solid fa-rotate';
    btn.title = '重新整理';
  }
}

async function loadCloudData(user) {
  // 有快取先顯示，再背景更新
  if (store.loadCloudCache(user.email)) renderApp();
  else showLoading('從雲端載入資料…');
  try {
    await store.reloadFromCloud();
  } catch (err) {
    handleCloudError(err);
  } finally {
    hideLoading();
  }
}

function initCloudMode() {
  store.onChange(renderApp);
  store.onSyncState(updateSyncIndicator);
  store.setErrorHandler(handleCloudError);

  document.getElementById('backup-desc').textContent =
    '資料儲存在雲端（Google 試算表），換手機或電腦登入同一個 Google 帳號即可使用。也可以匯出備份檔自行保存。';
  document.getElementById('import-desc').textContent = '以備份檔取代你在雲端的所有資料';

  document.getElementById('btn-sync').addEventListener('click', () => {
    if (store.hasPendingSync()) return;
    store.reloadFromCloud()
      .then(() => showToast('已更新為雲端最新資料'))
      .catch(handleCloudError);
  });

  // 還有資料尚未同步時，離開頁面前提醒
  window.addEventListener('beforeunload', (e) => {
    if (store.hasPendingSync()) e.preventDefault();
  });

  startSession(loadCloudData);
}

// 本機模式直接使用瀏覽器資料；雲端模式需先登入
if (isCloudMode) {
  initCloudMode();
} else {
  store.load();
  renderApp();
}
