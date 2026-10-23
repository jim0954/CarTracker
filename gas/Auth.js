// --- 身分驗證：Google ID Token + 成員白名單 ---

const TOKEN_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// 向 Google 驗證 ID Token，回傳 { email, name }；驗證結果快取到 token 過期前
function verifyIdToken_(idToken) {
  const clientId = getSetting_('CLIENT_ID');
  if (!clientId) throw new AppError_('SETUP', '管理者尚未在「設定」分頁填入 CLIENT_ID');

  const cache = CacheService.getScriptCache();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken, Utilities.Charset.UTF_8);
  const cacheKey = 'tok_' + Utilities.base64EncodeWebSafe(digest);
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new AppError_('AUTH_INVALID', '登入已失效，請重新登入');

  const claims = JSON.parse(res.getContentText());
  const nowSec = Math.floor(Date.now() / 1000);
  if (claims.aud !== clientId) throw new AppError_('AUTH_INVALID', '登入憑證不屬於本系統');
  if (TOKEN_ISSUERS.indexOf(claims.iss) === -1) throw new AppError_('AUTH_INVALID', '登入憑證來源不正確');
  if (String(claims.email_verified) !== 'true') throw new AppError_('AUTH_INVALID', 'Google 帳號 Email 尚未驗證');
  if (Number(claims.exp) <= nowSec) throw new AppError_('AUTH_INVALID', '登入已過期，請重新登入');

  const user = { email: String(claims.email).toLowerCase(), name: claims.name || claims.email };
  const ttl = Math.min(Number(claims.exp) - nowSec - 60, 21600);
  if (ttl > 0) cache.put(cacheKey, JSON.stringify(user), ttl);
  return user;
}

// 成員狀態不快取，管理者取消勾選「啟用」後立即生效
function authenticate_(idToken) {
  if (!idToken) throw new AppError_('AUTH_REQUIRED', '請先登入');
  const user = verifyIdToken_(idToken);
  const member = readTable_('members').rows.find(r => r.email.toLowerCase() === user.email);
  if (!member || !member.enabled) {
    throw new AppError_('NOT_MEMBER', `${user.email} 尚未開通，請聯絡管理者加入「成員」名單`);
  }
  return { email: user.email, name: member.name || user.name };
}
