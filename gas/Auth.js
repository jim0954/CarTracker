// --- 身分驗證：Google ID Token + 成員白名單 ---

const TOKEN_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
// 每 10 分鐘最多向 Google 驗證幾次：網址是公開的，避免被灌假 token 耗盡每日 UrlFetch 配額。
// 成員平常用 30 天工作階段，只有登入時才需要向 Google 驗證，正常用量遠低於此
const TOKENINFO_LIMIT_PER_10MIN = 100;

function decodeJwtPayload_(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  try {
    return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1], Utilities.Charset.UTF_8)).getDataAsString('UTF-8'));
  } catch (e) {
    return null;
  }
}

// 不打 API 的初步檢查：格式、對象、來源、期限；不符就直接拒絕
function precheckIdToken_(idToken, clientId) {
  const claims = decodeJwtPayload_(idToken);
  if (!claims || claims.aud !== clientId || TOKEN_ISSUERS.indexOf(claims.iss) === -1 ||
      !(Number(claims.exp) > Math.floor(Date.now() / 1000))) {
    throw new AppError_('AUTH_INVALID', '登入已失效，請重新登入');
  }
}

function countTokeninfoCall_(cache) {
  const key = 'tokeninfo_' + Math.floor(Date.now() / 600000);
  const count = Number(cache.get(key) || 0) + 1;
  if (count > TOKENINFO_LIMIT_PER_10MIN) throw new AppError_('AUTH_INVALID', '登入驗證過於頻繁，請稍後再試');
  cache.put(key, String(count), 900);
}

// 向 Google 驗證 ID Token，回傳 { email, name }；驗證結果快取到 token 過期前
function verifyIdToken_(idToken) {
  const clientId = getSetting_('CLIENT_ID');
  if (!clientId) throw new AppError_('SETUP', '管理者尚未在「設定」分頁填入 CLIENT_ID');

  const cache = CacheService.getScriptCache();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken, Utilities.Charset.UTF_8);
  const cacheKey = 'tok_' + Utilities.base64EncodeWebSafe(digest);
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  precheckIdToken_(idToken, clientId);
  countTokeninfoCall_(cache);
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

// --- 登入工作階段：Google ID Token 只有 1 小時，驗證後改發 30 天的自簽憑證 ---
// 格式 s.<base64(JSON {e, n, x})>.<HMAC-SHA256>；金鑰存在指令碼屬性，換掉金鑰即全部登出
const SESSION_DAYS = 30;
const SESSION_RENEW_DAYS = 15; // 剩不到 15 天時於回應中換發新的

function sessionSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SESSION_SECRET', secret);
  }
  return secret;
}

function signSession_(body) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, sessionSecret_()));
}

// 固定時間比較，避免以回應時間差逐字猜簽章
function safeEqual_(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function issueSession_(user) {
  const expiresAt = Date.now() + SESSION_DAYS * DAY_MS;
  const body = Utilities.base64EncodeWebSafe(JSON.stringify({ e: user.email, n: user.name, x: expiresAt }), Utilities.Charset.UTF_8);
  return { token: `s.${body}.${signSession_(body)}`, expiresAt };
}

function verifySession_(token) {
  const parts = token.split('.');
  if (parts.length !== 3 || !safeEqual_(signSession_(parts[1]), parts[2])) throw new AppError_('AUTH_INVALID', '登入已失效，請重新登入');
  const p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1], Utilities.Charset.UTF_8)).getDataAsString('UTF-8'));
  if (!(Number(p.x) > Date.now())) throw new AppError_('AUTH_INVALID', '登入已過期，請重新登入');
  return { email: String(p.e).toLowerCase(), name: p.n, expiresAt: Number(p.x) };
}

// 成員狀態不快取，管理者取消勾選「啟用」後立即生效（工作階段也一樣）
// 回傳 { user, session }：以 Google 登入或工作階段快到期時附上新的工作階段
function authenticate_(token) {
  if (!token) throw new AppError_('AUTH_REQUIRED', '請先登入');
  const isSession = token.startsWith('s.');
  const user = isSession ? verifySession_(token) : verifyIdToken_(token);
  const member = readTable_('members').rows.find(r => r.email.toLowerCase() === user.email);
  if (!member || !member.enabled) {
    throw new AppError_('NOT_MEMBER', `${user.email} 尚未開通，請聯絡管理者加入「成員」名單`);
  }
  const renew = !isSession || user.expiresAt - Date.now() < SESSION_RENEW_DAYS * DAY_MS;
  return {
    user: { email: user.email, name: member.name || user.name },
    session: renew ? issueSession_(user) : null
  };
}
