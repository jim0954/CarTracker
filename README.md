# CarTracker 汽機車保養紀錄

給家人一起使用的汽機車保養、加油、花費紀錄網頁。

**線上版：** https://jim0954.github.io/CarTracker/

## 功能
- 多台車輛管理（汽車 / 機車）
- 保養項目依「里程」與「月數」自動判斷狀態：良好 / 即將到期 / 已逾期
- 用車流水帳：保養、加油、稅金保險、改裝其他
- 加油紀錄自動計算油耗（km/L）與每公里油資
- 每月花費趨勢與支出類別圖表
- 匯出 JSON 備份 / CSV 表格，匯入還原

## 專案結構
```
index.html            主頁面
css/app.css           自訂樣式
js/main.js            程式進入點、按鈕事件委派
js/state.js           狀態與本機儲存
js/utils.js           共用工具（格式化、提示訊息、對話框）
js/sample-data.js     示範資料
js/render/            各分頁畫面
js/actions/           各功能的事件處理
assets/               圖片
```
不需要任何打包工具，GitHub Pages 直接部署 `main` 分支根目錄。

## 本機開發
ES 模組無法用 `file://` 直接開啟，需要啟動本機伺服器：

```bash
npx serve .
```

或使用 VS Code 的 Live Server 擴充套件。

## 開發計畫
- [x] 第 0 階段：整理專案、上傳 GitHub
- [ ] 第 1 階段：資料存取層、XSS 修正
- [ ] 第 2 階段：Google Apps Script + 試算表後台，各自 Google 帳號登入
- [ ] 第 3 階段：Google 日曆保養提醒、每日 Email 提醒
- [ ] 第 4 階段：PWA 手機加到主畫面
