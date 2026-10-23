// --- 呼叫 Google Apps Script 後台 ---
// 以 text/plain 送出 JSON，屬於「簡單請求」，不會觸發 CORS 預檢。
import { CONFIG } from './config.js';
import { getIdToken, invalidateToken } from './auth.js';

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const AUTH_ERROR_CODES = ['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_EXPIRED', 'NOT_MEMBER'];

export async function call(action, payload = {}, retry = true) {
  const idToken = await getIdToken();

  let res;
  try {
    res = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, idToken, payload })
    });
  } catch (e) {
    throw new ApiError('NETWORK', '無法連線到伺服器，請檢查網路');
  }
  if (!res.ok) throw new ApiError('NETWORK', `伺服器回應錯誤 (${res.status})`);

  const body = await res.json();
  if (body.ok) return body.data;

  // token 被後台判定無效時重新取得一次
  if (body.code === 'AUTH_INVALID' && retry) {
    invalidateToken();
    return call(action, payload, false);
  }
  throw new ApiError(body.code, body.error);
}
