# CarTracker 汽機車保養紀錄

給家人一起使用的汽機車保養、加油、花費紀錄網頁。每個人用自己的 Google 帳號登入、管理自己的車輛；
保養快到期時會出現在 Google 日曆，並寄 Email 提醒。

**線上版：** https://jim0954.github.io/CarTracker/

## 功能
- 多台車輛管理（汽車 / 機車）
- 保養項目依「里程」與「月數」自動判斷狀態：良好 / 即將到期 / 已逾期
- 依平均每日里程推算「預計到期日」
- 用車流水帳：保養、加油、稅金保險、改裝其他
- 加油紀錄自動計算油耗（km/L）與每公里油資
- 每月花費趨勢與支出類別圖表
- 匯出 JSON 備份 / CSV 表格，匯入還原
- Google 日曆：保養到期事件自動建立並邀請擁有者；也可手動「加入 Google 日曆」
- 每日 Email 提醒（即將到期 / 已到期）
- 手機可「加到主畫面」使用（PWA），支援離線開啟

## 運作模式
| 模式 | 條件 | 資料存放 |
|---|---|---|
| 本機模式 | `js/config.js` 未填設定 | 只存在目前瀏覽器 |
| 雲端模式 | `js/config.js` 填入 GAS 網址與 OAuth Client ID | 管理者的 Google 試算表，各自帳號隔離 |

雲端模式的設定步驟請看 **[docs/SETUP.md](docs/SETUP.md)**。

## 架構
```
瀏覽器（GitHub Pages）── Google 登入取得 ID Token
   │  POST { action, idToken, payload }
   ▼
Google Apps Script（以管理者身分執行）
   ├─ 驗證 ID Token、比對「成員」白名單
   ├─ Google 試算表：成員 / 車輛 / 保養項目 / 紀錄 / 設定
   ├─ Google 日曆：保養到期事件
   └─ 每日 8 點排程：重新推算到期日、補建日曆事件、寄 Email 提醒
```

## 專案結構
```
index.html            主頁面
manifest.webmanifest  PWA 設定
sw.js                 Service Worker（離線快取）
css/app.css           自訂樣式
js/config.js          雲端設定（GAS 網址、OAuth Client ID）
js/main.js            程式進入點
js/store.js           資料存取層（本機 / 雲端樂觀更新同步）
js/api.js             呼叫 GAS 後台
js/auth.js            Google 登入
js/session.js         登入畫面與使用者選單
js/render/            各分頁畫面
js/actions/           各功能的事件處理
gas/                  Google Apps Script 後台程式
tests/gas/            後台單元測試與本機模擬後台
docs/SETUP.md         Google 端設定教學
```
前端不需要打包工具，GitHub Pages 直接部署 `main` 分支根目錄。

## 本機開發
ES 模組無法用 `file://` 直接開啟，需要啟動本機伺服器：

```bash
npx serve .
```

後台單元測試（不需要 Google 帳號）：

```bash
node tests/gas/run.js
```

更新後台程式（已設定 clasp）：

```bash
clasp push
```
推送後到 Apps Script「部署 → 管理部署作業 → 編輯 → 新版本」發布。

## 開發進度
- [x] 第 0 階段：整理專案、上傳 GitHub
- [x] 第 1 階段：資料存取層、XSS 修正
- [x] 第 2 階段：Google Apps Script + 試算表後台，各自 Google 帳號登入
- [x] 第 3 階段：Google 日曆保養提醒、每日 Email 提醒
- [x] 第 4 階段：PWA 手機加到主畫面
- [ ] 完成 Google 端設定並上線雲端模式
- [ ] 選做：LINE 推播、共用車輛、收據拍照、保險 / 驗車 / 稅金提醒
