// --- 資料備份：匯出 JSON / CSV、匯入、重設示範資料 ---
import { appState, setAppState, saveState, getCurrentVehicle, cloneInitialState } from '../state.js';
import { showToast, openModal, closeModal, openConfirmModal } from '../utils.js';
import { renderApp } from '../render/app.js';

export function initBackupActions() {
  document.getElementById('btn-open-backup-modal').addEventListener('click', () => {
    openModal('modal-backup');
  });

  // 1. 匯出 JSON
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
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
    const v = getCurrentVehicle();
    const records = appState.records.filter(r => r.vehicleId === v.id);

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
        if (parsed && parsed.vehicles && parsed.maintenanceItems && parsed.records) {
          setAppState(parsed);
          saveState();
          closeModal('modal-backup');
          renderApp();
          showToast('備份資料已成功還原！');
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

  // 4. 重設示範資料
  document.getElementById('btn-reset-demo').addEventListener('click', () => {
    openConfirmModal('重設範例資料', '您確定要重設為預設範例資料嗎？目前的記錄將會被覆蓋。', () => {
      setAppState(cloneInitialState());
      saveState();
      closeModal('modal-backup');
      renderApp();
      showToast('已重設為預設示範資料');
    });
  });
}
