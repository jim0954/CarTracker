# 從愛車99 搬資料過來

> **免責聲明**：本工具為非官方的個人專案，與愛車99（iKnow99，明紫科技有限公司）無任何關聯，亦未經其授權或背書。
> 僅供使用者匯出、轉移**自己的**資料；收集器只記錄使用者登入後瀏覽器原本就會載入的內容，不拆解或修改該服務的程式，也不會自動抓取或存取他人資料。
> 「愛車99」及相關名稱、商標為其所有者所有。使用前請自行確認符合該服務的使用條款。

愛車99（iknow99.com）沒有匯出功能，取得自己的資料有兩種方式：

- **官方管道**：依愛車99 隱私權政策「您得行使之權利及選擇」，可寄信到 `iknow99.service(at)gmail.com`（或登入後透過「問題/建議」）要求提供您的個人資料
- **自行匯出**：用下面的「收集器」記下網站載入的您自己的資料，再到 CarTracker 匯入。需要電腦版 Chrome（或 Edge），大約 5 分鐘

以下說明自行匯出的步驟。

## 步驟 1：在愛車99 啟動收集器

1. 在 iknow99.com 登入，停在車輛管理頁
2. 按 **F12** 開啟開發者工具，切到「**Console（主控台）**」分頁
3. 貼上下面整段程式按 Enter
   （Chrome 第一次貼上會要求先輸入 `allow pasting`，照做後再貼一次）

```js
(() => {
  const log = window.__ck = window.__ck || [];
  const keep = (url, text) => {
    try {
      const j = JSON.parse(text);
      if (j && j.data) {
        log.push({ url: String(url).split('?')[0], data: j.data });
        console.log('CarTracker 已收集', log.length, '筆');
      }
    } catch (e) {}
  };
  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__ckUrl = u; return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', () => keep(this.__ckUrl,
      this.responseType === '' || this.responseType === 'text' ? this.responseText : JSON.stringify(this.response)));
    return XS.apply(this, arguments);
  };
  const F = window.fetch;
  window.fetch = async function (input) {
    const res = await F.apply(this, arguments);
    res.clone().text().then(t => keep(input && input.url || input, t)).catch(() => {});
    return res;
  };
  window.ckDownload = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(log)], { type: 'application/json' }));
    a.download = 'iknow99_export.json';
    a.click();
  };
  console.log('CarTracker 收集器已啟動：請點開每台車、每筆紀錄，完成後輸入 ckDownload()');
})();
```

收集器只在目前這個分頁記錄網站回傳的資料，不會送出任何東西，也不會記錄登入憑證；重新整理頁面就會消失。

## 步驟 2：點開所有資料

**不要重新整理頁面**，在網頁上：
- 切換到**每一台車**，紀錄列表有分頁的話每一頁都要翻到
- 點開**每一筆紀錄**的明細（保養、加油、新車保養週期），看到明細即可，不用修改

沒點開明細的保養紀錄仍會匯入日期、里程與金額，只是不知道換了哪些項目。

## 步驟 3：下載並匯入

1. 在 Console 輸入 `ckDownload()` 按 Enter，下載 `iknow99_export.json`
2. 打開 CarTracker →「資料備份」→「**從愛車99 匯入**」→ 選擇這個檔案
3. 確認畫面列出的車輛與紀錄數量後按「確定」

匯入是**附加**的，不會覆蓋 CarTracker 既有資料；同一個檔案重複匯入會產生重複資料。

## 匯入後

- 車名會是「愛車99 機車 1（2016 起）」這類名稱，請到「車輛設定」改成車名與車牌
- 車種（汽車 / 機車）依保養項目自動判斷，判斷錯誤時在「車輛設定」修改
- 保養項目的週期與「上次更換」取自愛車99 目前的狀態
- 愛車99 的「新車保養週期」會建立保養項目，另外存成一筆 0 元的「牽新車（新車保養週期）」紀錄，當作牽車日期
