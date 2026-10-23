// --- 登入流程與畫面（雲端模式）---
import { initAuth, renderSignInButton, onSignIn, signOut } from './auth.js';

const $ = id => document.getElementById(id);

export function showLogin(message = '') {
  $('login-screen').classList.remove('hidden');
  $('user-chip').classList.add('hidden');
  const msg = $('login-message');
  msg.textContent = message;
  msg.classList.toggle('hidden', !message);
  renderSignInButton($('google-signin-btn'));
}

function hideLogin() {
  $('login-screen').classList.add('hidden');
}

export function showLoading(text = '載入中…') {
  $('loading-text').textContent = text;
  $('loading-screen').classList.remove('hidden');
}

export function hideLoading() {
  $('loading-screen').classList.add('hidden');
}

function showUser(user) {
  // 沒有大頭貼時顯示名字的第一個字
  $('user-avatar').src = user.picture || '';
  $('user-avatar').classList.toggle('hidden', !user.picture);
  $('user-initial').textContent = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  $('user-initial').classList.toggle('hidden', !!user.picture);
  $('user-name').textContent = user.name;
  $('user-menu-name').textContent = user.name;
  $('user-menu-email').textContent = user.email;
  $('user-chip').classList.remove('hidden');
}

// 頭像選單：點頭像開關，點其他地方關閉
function initUserMenu() {
  $('btn-user-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    $('user-menu').classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!$('user-menu').contains(e.target)) $('user-menu').classList.add('hidden');
  });
}

// 登入成功（含之後重新登入）時呼叫 onLoggedIn(user)
export async function startSession(onLoggedIn) {
  initUserMenu();

  // 登出時一併清除本機的雲端資料快取（共用裝置時保護隱私）
  $('btn-sign-out').addEventListener('click', () => {
    signOut();
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('cartracker_cache_'))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) { /* 忽略 */ }
    location.reload();
  });

  onSignIn(user => {
    hideLogin();
    showUser(user);
    onLoggedIn(user);
  });

  try {
    const user = await initAuth();
    if (user) {
      showUser(user);
      onLoggedIn(user);
    } else {
      showLogin();
    }
  } catch (err) {
    $('login-screen').classList.remove('hidden');
    const msg = $('login-message');
    msg.textContent = err.message;
    msg.classList.remove('hidden');
  }
}
