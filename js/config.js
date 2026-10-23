// --- 雲端設定 ---
// 兩個值都填入後啟用 Google 登入與雲端同步；留空則為本機模式（資料只存在此瀏覽器）。
// 這兩個值公開在 GitHub 上沒有關係，安全性由後台的 ID Token 驗證與成員名單把關。
export const CONFIG = {
  // Apps Script 網頁應用程式網址：https://script.google.com/macros/s/xxxx/exec
  GAS_URL: '',
  // Google Cloud OAuth 用戶端 ID：xxxx.apps.googleusercontent.com
  GOOGLE_CLIENT_ID: ''
};

export const isCloudMode = Boolean(CONFIG.GAS_URL && CONFIG.GOOGLE_CLIENT_ID);
