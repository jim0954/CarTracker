// --- 網頁應用程式入口 ---
// 前端以 POST (Content-Type: text/plain) 送出 JSON：{ action, idToken, payload }
// 回應：{ ok: true, data } 或 { ok: false, code, error }

const API_VERSION = 1;

const ROUTES = {
  bootstrap: (user) => ({ user, ...svcBootstrap_(user.email) }),
  saveVehicle: (user, p) => svcSaveVehicle_(user.email, p.vehicle),
  deleteVehicle: (user, p) => svcDeleteVehicle_(user.email, p.id),
  saveItem: (user, p) => svcSaveItem_(user.email, p.item),
  deleteItem: (user, p) => svcDeleteItem_(user.email, p.id),
  saveRecord: (user, p) => svcSaveRecord_(user.email, p.record),
  deleteRecord: (user, p) => svcDeleteRecord_(user.email, p.id),
  importAll: (user, p) => svcImportAll_(user.email, p.data)
};

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 用瀏覽器打開網址可確認部署成功
function doGet() {
  return json_({ ok: true, app: 'CarTracker', apiVersion: API_VERSION });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const handler = ROUTES[req.action];
    if (!handler) throw new AppError_('BAD_ACTION', `未知的操作：${req.action}`);
    const user = authenticate_(req.idToken);
    return json_({ ok: true, data: handler(user, req.payload || {}) });
  } catch (err) {
    if (!err.code) console.error(err);
    return json_({ ok: false, code: err.code || 'SERVER_ERROR', error: err.code ? err.message : '伺服器發生錯誤，請稍後再試' });
  }
}
