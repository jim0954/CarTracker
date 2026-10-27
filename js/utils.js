// --- 共用工具 ---

export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('zh-TW');
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr;
}

// 將使用者輸入的文字轉義後才能放進 innerHTML，避免 XSS
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- 日期：一律用裝置的本地日期（toISOString 是 UTC，台灣 0~8 點會變成前一天）---
const pad2 = n => String(n).padStart(2, '0');

export function toDateStr(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

// 'YYYY-MM-DD' 解析為本地午夜（new Date('YYYY-MM-DD') 會被當成 UTC）
export function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

// 加月數，月底不溢位（1/31 + 1 個月 = 2/28），與後台 addMonths_ 一致
export function addMonths(date, months) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

// 兩個本地日期相差的天數
export function daysBetween(from, to) {
  return Math.round((to - from) / 86400000);
}

// --- Toast ---
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold border backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 ${
    type === 'success' ? 'bg-emerald-900/90 text-emerald-200 border-emerald-700/80' :
    type === 'error' ? 'bg-rose-900/90 text-rose-200 border-rose-700/80' :
    'bg-slate-800/95 text-slate-200 border-slate-700'
  }`;

  const icon = type === 'success' ? 'fa-circle-check text-emerald-400' :
               type === 'error' ? 'fa-circle-exclamation text-rose-400' :
               'fa-circle-info text-sky-400';

  toast.innerHTML = `<i class="fa-solid ${icon} text-sm"></i><span></span>`;
  toast.querySelector('span').textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- 確認視窗 ---
let confirmCallback = null;
let cancelCallback = null;

export function openConfirmModal(title, message, onConfirm, onCancel = null) {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;
  confirmCallback = onConfirm;
  cancelCallback = onCancel;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  confirmCallback = null;
  cancelCallback = null;
}

// --- 一般 Modal ---
// 視窗比畫面高時可捲動；每次開啟都從最上方開始
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('hidden');
  modal.scrollTop = 0;
}

export function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

export function initModals() {
  document.getElementById('confirm-modal-cancel').addEventListener('click', () => {
    if (cancelCallback) cancelCallback();
    closeConfirmModal();
  });
  document.getElementById('confirm-modal-ok').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.fixed').classList.add('hidden');
    });
  });

  // 點背景關閉
  ['modal-mileage', 'modal-record', 'modal-item', 'modal-item-history', 'modal-vehicle', 'modal-backup'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('click', function(e) {
      if (e.target === this) this.classList.add('hidden');
    });
  });
}
