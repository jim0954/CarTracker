// --- Google 登入（Google Identity Services）---
// Google ID Token 只有 1 小時，手機（尤其 iPhone）常無法自動續登。
// 後台驗證 Google 登入後會回傳 30 天的工作階段，之後的請求都改用它，到期前自動換新。
import { CONFIG } from './config.js';

const TOKEN_KEY = 'cartracker_id_token';
const SESSION_KEY = 'cartracker_session';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const REFRESH_TIMEOUT_MS = 20000;

let token = null;
let session = null; // { token, expiresAt, user }
let user = null;
let pendingRefresh = null;
const signInListeners = [];

function decodeJwt(jwt) {
  const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// 預留 1 分鐘緩衝，避免送到後台時剛好過期
function isFresh(jwt) {
  try {
    return decodeJwt(jwt).exp * 1000 > Date.now() + 60000;
  } catch (e) {
    return false;
  }
}

function sessionValid() {
  return !!(session && session.expiresAt > Date.now() + 60000);
}

// 後台回傳新的工作階段時由 api.js 呼叫
export function setSession({ token: sessionToken, expiresAt }) {
  if (!user) return;
  session = { token: sessionToken, expiresAt, user };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) { /* 無痕模式等情況可忽略 */ }
}

function setToken(jwt) {
  token = jwt;
  const claims = decodeJwt(jwt);
  user = { email: claims.email, name: claims.name || claims.email, picture: claims.picture || '' };
  try {
    localStorage.setItem(TOKEN_KEY, jwt);
  } catch (e) { /* 無痕模式等情況可忽略 */ }
}

function handleCredential(response) {
  setToken(response.credential);
  if (pendingRefresh) {
    pendingRefresh.resolve(token);
    pendingRefresh = null;
  }
  signInListeners.forEach(cb => cb(user));
}

// 載入並初始化 Google 登入元件（只做一次；失敗時下次再試）
let gisReady = null;
function ensureGis() {
  if (!gisReady) {
    gisReady = loadGis().then(initGis).catch(err => {
      gisReady = null;
      throw err;
    });
  }
  return gisReady;
}

function loadGis() {
  if (window.google && window.google.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('無法載入 Google 登入元件，請檢查網路'));
    document.head.appendChild(s);
  });
}

// 回傳已登入的使用者（工作階段或 token 仍有效時），否則回傳 null
export async function initAuth() {
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch (e) {
    session = null;
  }
  if (sessionValid()) {
    user = session.user;
    // 已登入時不必等 Google 元件（離線也能開）；背景載入供登出後重新登入使用
    ensureGis().catch(() => {});
    return user;
  }

  await ensureGis();
  let saved = null;
  try {
    saved = localStorage.getItem(TOKEN_KEY);
  } catch (e) { /* 忽略 */ }
  if (saved && isFresh(saved)) {
    setToken(saved);
    return user;
  }
  return null;
}

function initGis() {
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredential,
    auto_select: true,
    cancel_on_tap_outside: false,
    use_fedcm_for_prompt: true
  });
}

export function renderSignInButton(el) {
  el.innerHTML = '';
  ensureGis().then(() => {
    google.accounts.id.renderButton(el, {
      theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'zh-TW'
    });
    google.accounts.id.prompt();
  }).catch(err => {
    el.textContent = err.message;
  });
}

export function onSignIn(cb) {
  signInListeners.push(cb);
}

export function getUser() {
  return user;
}

// 過期時以 One Tap 自動重新登入；失敗則拋出錯誤由畫面顯示登入頁
export function getIdToken() {
  if (sessionValid()) return Promise.resolve(session.token);
  if (token && isFresh(token)) return Promise.resolve(token);
  if (!pendingRefresh) {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pendingRefresh = { promise, resolve, reject };
    ensureGis().then(() => google.accounts.id.prompt()).catch(() => {});
    setTimeout(() => {
      if (pendingRefresh && pendingRefresh.promise === promise) {
        pendingRefresh = null;
        const err = new Error('登入已過期，請重新登入');
        err.code = 'AUTH_EXPIRED';
        reject(err);
      }
    }, REFRESH_TIMEOUT_MS);
  }
  return pendingRefresh.promise;
}

// 後台回報 token 無效時呼叫，強制下次重新取得
export function invalidateToken() {
  token = null;
  session = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch (e) { /* 忽略 */ }
}

export function signOut() {
  invalidateToken();
  user = null;
  if (window.google && window.google.accounts) google.accounts.id.disableAutoSelect();
}
