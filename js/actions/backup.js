// --- 資料備份：匯出 JSON / CSV、匯入、重設示範資料 ---
import * as store from '../store.js';
import { showToast, openModal, closeModal, openConfirmModal, todayStr } from '../utils.js';
import { showLoading, hideLoading } from '../session.js';
import { renderApp } from '../render/app.js';
import { isIknow99Export, convertIknow99 } from '../iknow99.js';

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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initBackupActions() {
  document.getElementById('btn-open-backup-modal').addEventListener('click', () => {
    openModal('modal-backup');
  });

  // 1. 匯出 JSON
  document.getElementById('btn-export-json').addEventListener('click', () => {
    // 用 Blob 下載：data: 網址在部分手機瀏覽器有長度上限，資料多時會下載失敗
    const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' });
    downloadBlob(blob, `cartracker_backup_${todayStr().replace(/-/g, '')}.json`);
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
      // 開頭是 = + - @ 的文字在 Excel 會被當成公式執行，前面補 ' 當純文字
      const clean = (str) => {
        const text = String(str || '');
        return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
      };

      csvContent += `${r.date},${clean(v.name)},${clean(v.plate)},${typeText},${r.mileage},${clean(r.title)},${r.amount},${clean(r.vendor)},${liters},${unitPrice},${clean(r.notes)}\n`;
    });

    downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${v.plate || v.name}_用車明細表.csv`);
    showToast('已匯出 CSV 試算表！');
  });

  // 2-1. 寄一份備份到我的信箱（雲端模式）
  document.getElementById('btn-email-backup').addEventListener('click', async () => {
    closeModal('modal-backup');
    showLoading('備份信寄送中…');
    try {
      const { to } = await store.emailBackup();
      showToast(`備份已寄到 ${to}`);
    } catch (err) {
      showToast(err.message || '寄送失敗', 'error');
    } finally {
      hideLoading();
    }
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

  // 4. 從愛車99 匯入（附加，不覆蓋）
  document.getElementById('btn-trigger-import-iknow99').addEventListener('click', () => {
    document.getElementById('input-import-iknow99').click();
  });

  document.getElementById('input-import-iknow99').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      let parsed;
      try {
        parsed = JSON.parse(evt.target.result);
      } catch (err) {
        showToast('無法解析此檔案，請確認是收集器下載的 iknow99_export.json', 'error');
        return;
      }
      if (!isIknow99Export(parsed)) {
        showToast('檔案中找不到愛車99 的紀錄資料', 'error');
        return;
      }
      const { data, missingDetails } = convertIknow99(parsed);
      if (data.vehicles.length === 0) {
        showToast('檔案中沒有車輛的紀錄列表，請在愛車99 點開每台車的紀錄後再下載', 'error');
        return;
      }
      const lines = data.vehicles.map(v => {
        const items = data.maintenanceItems.filter(it => it.vehicleId === v.id).length;
        const records = data.records.filter(r => r.vehicleId === v.id).length;
        return `• ${v.name}：${records} 筆紀錄、${items} 個保養項目`;
      });
      let message = `將加入以下車輛（不會覆蓋現有資料）：\n${lines.join('\n')}`;
      if (missingDetails > 0) message += `\n\n有 ${missingDetails} 筆保養沒有點開明細，只會匯入日期、里程與金額。`;
      message += '\n\n匯入後請到「車輛設定」修改車名與車牌。重複匯入會產生重複的資料。';
      openConfirmModal('從愛車99 匯入', message, () =>
        runImport(() => store.appendData(data), `已匯入 ${data.vehicles.length} 台車、${data.records.length} 筆紀錄`));
    };
    reader.readAsText(file);
    this.value = '';
  });

  // 5. 載入範例資料
  const loadSample = () => runImport(() => store.resetToSample(), '已載入範例資料');
  document.getElementById('btn-reset-demo').addEventListener('click', () => {
    openConfirmModal('載入範例資料', '確定要載入範例資料嗎？目前的記錄將會被覆蓋。', loadSample);
  });
  document.getElementById('btn-welcome-sample').addEventListener('click', loadSample);
}
