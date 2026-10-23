// --- Google 登入（Google Identity Services）---
// 取得的 ID Token 有效 1 小時，存在 localStorage；過期時自動嘗試無聲重新登入。
import { CONFIG } from './config.js';

const TOKEN_KEY = 'cartracker_id_token';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const REFRESH_TIMEOUT_MS = 20000;

let token = null;
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

// 回傳已登入的使用者（token 仍有效時），否則回傳 null
export async function initAuth() {
  await loadGis();
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredential,
    auto_select: true,
    cancel_on_tap_outside: false,
    use_fedcm_for_prompt: true
  });

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

export function renderSignInButton(el) {
  el.innerHTML = '';
  google.accounts.id.renderButton(el, {
    theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'zh-TW'
  });
  google.accounts.id.prompt();
}

export function onSignIn(cb) {
  signInListeners.push(cb);
}

export function getUser() {
  return user;
}

// 過期時以 One Tap 自動重新登入；失敗則拋出錯誤由畫面顯示登入頁
export function getIdToken() {
  if (token && isFresh(token)) return Promise.resolve(token);
  if (!pendingRefresh) {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pendingRefresh = { promise, resolve, reject };
    google.accounts.id.prompt();
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
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* 忽略 */ }
}

export function signOut() {
  invalidateToken();
  user = null;
  if (window.google && window.google.accounts) google.accounts.id.disableAutoSelect();
}
