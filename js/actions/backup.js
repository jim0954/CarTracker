// --- 資料備份：匯出 JSON / CSV、匯入、重設示範資料 ---
import * as store from '../store.js';
import { showToast, openModal, closeModal, openConfirmModal } from '../utils.js';
import { showLoading, hideLoading } from '../session.js';
import { renderApp } from '../render/app.js';

// 雲端模式下匯入需等後台寫入完成
async function runImport(task, successMessage) {
  closeModal('modal-backup');
  showLoading('資料寫入中…');
  try {
    await task();
    renderApp();
    showToast(successMessage);
  } catch (err) {
    showToast(err.message || '匯入失敗', 'error');
  } finally {
    hideLoading();
  }
}

export function initBackupActions() {
  document.getElementById('btn-open-backup-modal').addEventListener('click', () => {
    openModal('modal-backup');
  });

  // 1. 匯出 JSON
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(store.exportData(), null, 2));
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `cartracker_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('已匯出 JSON 備份檔！');
  });

  // 2. 匯出 CSV
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const v = store.getCurrentVehicle();
    if (!v) {
      showToast('目前沒有車輛可匯出', 'error');
      return;
    }
    const records = store.getRecords(v.id);

    let csvContent = '﻿'; // UTF-8 BOM
    csvContent += '日期,車輛名稱,車牌,類別,當時里程(km),項目摘要,金額(NT$),地點商家,公升數,單價,備註\n';

    records.forEach(r => {
      const typeMap = { maintenance: '保養維修', fuel: '加油', tax: '稅費保險', other: '其他' };
      const typeText = typeMap[r.type] || r.type;
      const liters = r.details && r.details.liters ? r.details.liters : '';
      const unitPrice = r.details && r.details.pricePerLiter ? r.details.pricePerLiter : '';
      const clean = (str) => `"${(str || '').replace(/"/g, '""')}"`;

      csvContent += `${r.date},${clean(v.name)},${clean(v.plate)},${typeText},${r.mileage},${clean(r.title)},${r.amount},${clean(r.vendor)},${liters},${unitPrice},${clean(r.notes)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${v.plate}_用車明細表.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('已匯出 CSV 試算表！');
  });

  // 3. 匯入 JSON
  document.getElementById('btn-trigger-import').addEventListener('click', () => {
    document.getElementById('input-import-file').click();
  });

  document.getElementById('input-import-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (store.isValidBackup(parsed)) {
          runImport(() => store.importData(parsed), '備份資料已成功還原！');
        } else {
          showToast('檔案格式不符合 CarTracker 備份規範', 'error');
        }
      } catch (err) {
        showToast('無法解析此 JSON 檔案', 'error');
      }
    };
    reader.readAsText(file);
    this.value = '';
  });

  // 4. 載入範例資料
  const loadSample = () => runImport(() => store.resetToSample(), '已載入範例資料');
  document.getElementById('btn-reset-demo').addEventListener('click', () => {
    openConfirmModal('載入範例資料', '確定要載入範例資料嗎？目前的記錄將會被覆蓋。', loadSample);
  });
  document.getElementById('btn-welcome-sample').addEventListener('click', loadSample);
}
