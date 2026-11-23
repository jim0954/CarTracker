// --- 介面主題：經典深色 / 明亮（車廠） ---
// 選擇存在這台裝置（localStorage），index.html 開頭的小段程式會先套用，避免閃爍。
// 顏色定義見 css/theme.css。
const THEME_KEY = 'cartracker_theme';
const THEME_COLOR = { classic: '#0f172a', garage: '#e2e5e0' };
const listeners = [];

export function getTheme() {
  return document.documentElement.dataset.theme === 'garage' ? 'garage' : 'classic';
}

function apply(theme) {
  if (theme === 'garage') document.documentElement.dataset.theme = 'garage';
  else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', THEME_COLOR[theme]);
  const label = document.getElementById('btn-theme-label');
  if (label) label.textContent = theme === 'garage' ? '改回深色經典介面' : '改用明亮介面';
}

export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) { /* 無痕模式等情況只套用這次 */ }
  apply(theme);
  listeners.forEach(cb => cb(theme));
}

// 圖表等用 JS 畫的元件在切換後需要重畫
export function onThemeChange(cb) {
  listeners.push(cb);
}

// 讀取主題色（"R G B" 變數）給 Chart.js 使用
export function themeColor(name, alpha = 1) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return `rgb(${value} / ${alpha})`;
}

export function initTheme() {
  apply(getTheme());
  const btn = document.getElementById('btn-theme');
  if (btn) btn.addEventListener('click', () => setTheme(getTheme() === 'garage' ? 'classic' : 'garage'));
}
