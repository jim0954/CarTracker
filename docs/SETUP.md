# Google 端設定教學

完成以下步驟後，網頁會從「本機模式」切換成「雲端模式」：家人用自己的 Google 帳號登入，各自的資料存在你的 Google 試算表。

> **從 GitHub fork 這個專案的人：** 請用你自己的 Google 帳號完整走一次以下步驟，建立屬於你自己的一套後台。
> 你的資料存在你自己的試算表，與原作者的網站互不相通。
> 下文的 `jim0954.github.io` 是原作者的網址，請一律換成你自己的 GitHub Pages 網址。

> 全部步驟都使用**你自己的 Google 帳號**（試算表、Apps Script、Google Cloud 都是同一個帳號）。

---

## 步驟 1：建立試算表

1. 到 [Google 試算表](https://sheets.google.com) 建立空白試算表，命名為 `CarTracker 資料庫`
2. 選單「擴充功能 → Apps Script」，會開啟綁定這份試算表的 Apps Script 專案
3. 左側「⚙ 專案設定」→ 複製「指令碼 ID」

## 步驟 2：把程式上傳到 Apps Script（二選一）

### 方法 A：用 clasp（推薦，之後更新程式我可以直接幫你推送）

1. 開啟 [Apps Script 使用者設定](https://script.google.com/home/usersettings)，把「Google Apps Script API」切換為**開啟**
2. 在終端機執行：
   ```bash
   npm install -g @google/clasp
   ```
   ```bash
   clasp login
   ```
   瀏覽器會開啟 Google 授權頁，登入並允許
3. 把「指令碼 ID」告訴 Claude，Claude 會建立 `.clasp.json` 並執行 `clasp push`

### 方法 B：手動複製貼上

在 Apps Script 編輯器中，依照 `gas/` 資料夾的檔案逐一新增同名指令碼檔案（`Code`、`Auth`、`Data`、`Service`、`DueDate`、`Setup`…）並貼上內容；
「專案設定」勾選「在編輯器中顯示 appsscript.json」，再把 `gas/appsscript.json` 內容貼上覆蓋。

## 步驟 3：初始化試算表

1. 在 Apps Script 編輯器上方的函式選單選 `setup`，按「執行」
2. 第一次會要求授權：選你的帳號 →「進階」→「前往 CarTracker（不安全）」→「允許」
   （這是你自己寫的程式，Google 未審核所以顯示警告，屬正常現象）
3. 回到試算表，會看到 `成員`、`車輛`、`保養項目`、`紀錄`、`設定` 五個分頁，你的 Email 已自動加入「成員」

## 步驟 4：部署為網頁應用程式

1. Apps Script 右上角「部署 → 新增部署作業」
2. 類型選「網頁應用程式」
   - 說明：`CarTracker API`
   - 執行身分：**我**
   - 誰可以存取：**所有人**
3. 按「部署」，複製「網頁應用程式網址」（`https://script.google.com/macros/s/.../exec`）
4. 用瀏覽器開這個網址，看到 `{"ok":true,"app":"CarTracker",...}` 代表成功

> 為什麼選「所有人」？網頁放在 GitHub Pages，必須讓瀏覽器能直接呼叫這個網址。
> 安全性由程式把關：每個請求都要帶 Google 登入憑證，並且 Email 必須在「成員」分頁中啟用，否則一律拒絕。

> 之後程式更新時：「部署 → 管理部署作業 → ✏ 編輯 → 版本選『新版本』→ 部署」，網址不會改變。

## 步驟 5：建立 Google 登入用的 OAuth 用戶端 ID

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)，上方建立新專案，命名 `CarTracker`
2. 左側選單「API 和服務 → OAuth 同意畫面」（或「Google Auth Platform」）→「開始」
   - 應用程式名稱：`CarTracker`
   - 使用者支援電子郵件：你的 Email
   - 目標對象：**外部**
   - 聯絡資訊：你的 Email → 完成
3. 「目標對象」頁面 → 按「**發布應用程式**」改為「正式版」
   （只用到登入的基本資料 email / 姓名，不需要 Google 審核；誰能使用由試算表「成員」分頁控制）
4. 「用戶端」→「建立用戶端」
   - 應用程式類型：**網頁應用程式**
   - 名稱：`CarTracker Web`
   - 已授權的 JavaScript 來源，新增兩筆：
     - 你的 GitHub Pages 網域，例如 `https://jim0954.github.io`（只填網域，不要加 `/CarTracker/`）
     - `http://localhost:5173`（本機測試用，對應 README 的 `npx serve . -l 5173`）
   - 按「建立」，複製「用戶端 ID」（`xxxx.apps.googleusercontent.com`）

## 步驟 6：填入設定

1. 試算表「設定」分頁 → `CLIENT_ID` 那一列的「值」貼上用戶端 ID
2. 把**網頁應用程式網址**和**用戶端 ID** 告訴 Claude，Claude 會填入 `js/config.js` 並推送到 GitHub

## 步驟 7：加入家人

在「成員」分頁新增一列：

| Email | 顯示名稱 | 啟用 | 提前提醒天數 | 日曆提醒 | Email提醒 |
|---|---|---|---|---|---|
| 家人的 Gmail | 爸爸 | ☑ | 7 | ☑ | ☑ |

- 取消勾選「啟用」即可停用該成員，立即生效
- 每個人只看得到自己的車輛與紀錄；你（管理者）可以在試算表看到全部資料

---

## 常見問題

**登入後顯示「尚未開通」**：該 Email 不在「成員」分頁，或沒有勾選「啟用」。

**顯示「管理者尚未在設定分頁填入 CLIENT_ID」**：步驟 6 的第 1 點未完成。

**Google 登入按鈕顯示錯誤 `origin_mismatch`**：步驟 5 的「已授權的 JavaScript 來源」沒有加入目前網址。本機測試請用 `http://localhost:5173` 開啟（不要用 `127.0.0.1`）。

**可以直接在試算表修改資料嗎？** 可以。改完後在網頁按右上角的「↻ 重新整理」即可看到。
「類型」欄請使用下拉選單中的值；ID 欄位請勿修改。
