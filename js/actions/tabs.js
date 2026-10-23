// --- 分頁切換（上方分頁列與手機底部導覽列共用）---
import * as store from '../store.js';
import { renderStatsTab } from '../render/stats.js';

const TABS = ['maintenance', 'records', 'fuel', 'stats'];

function activateTab(name) {
  TABS.forEach(t => {
    const active = t === name;
    document.getElementById(`tab-content-${t}`).classList.toggle('hidden', !active);

    const btn = document.getElementById(`tab-btn-${t}`);
    btn.classList.toggle('bg-emerald-500/20', active);
    btn.classList.toggle('text-emerald-400', active);
    btn.classList.toggle('border-emerald-500/40', active);
    btn.classList.toggle('text-slate-400', !active);
    btn.classList.toggle('border-transparent', !active);

    const mobileBtn = document.querySelector(`.mobile-tab[data-tab="${t}"]`);
    mobileBtn.classList.toggle('text-emerald-400', active);
    mobileBtn.classList.toggle('text-slate-400', !active);
  });

  // 切到統計分頁時重畫圖表
  if (name === 'stats') {
    renderStatsTab(store.getCurrentVehicle());
  }
  window.scrollTo({ top: 0 });
}

export function initTabs() {
  TABS.forEach(t => {
    document.getElementById(`tab-btn-${t}`).addEventListener('click', () => activateTab(t));
  });
  document.querySelectorAll('.mobile-tab').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
}
