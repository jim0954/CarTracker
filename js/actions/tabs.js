// --- 分頁切換 ---
import * as store from '../store.js';
import { renderStatsTab } from '../render/stats.js';

export function initTabs() {
  const tabButtons = [
    { btn: document.getElementById('tab-btn-maintenance'), pane: document.getElementById('tab-content-maintenance') },
    { btn: document.getElementById('tab-btn-records'), pane: document.getElementById('tab-content-records') },
    { btn: document.getElementById('tab-btn-fuel'), pane: document.getElementById('tab-content-fuel') },
    { btn: document.getElementById('tab-btn-stats'), pane: document.getElementById('tab-content-stats') }
  ];

  tabButtons.forEach(tab => {
    tab.btn.addEventListener('click', () => {
      tabButtons.forEach(t => {
        t.pane.classList.add('hidden');
        t.btn.classList.remove('bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/40');
        t.btn.classList.add('text-slate-400', 'border-transparent');
      });
      tab.pane.classList.remove('hidden');
      tab.btn.classList.add('bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/40');
      tab.btn.classList.remove('text-slate-400', 'border-transparent');

      // 切到統計分頁時重畫圖表
      if (tab.pane.id === 'tab-content-stats') {
        renderStatsTab(store.getCurrentVehicle());
      }
    });
  });
}
