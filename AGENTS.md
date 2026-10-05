# Codex 專案指引

## 溝通與產品目標

- 使用者稱呼：Hulk；角色是設計師，不假設他熟悉程式。
- 一律用繁體中文回覆，先說結果，再補必要的技術資訊。
- 產品名稱是「案場通」，是澤居統包／室內裝修使用的 ERP。
- 正式站：`https://zeju.easycase.tw/`
- GitHub：`eve1995927-svg/omnight`
- 主要用途：案場、報價、合約、廠商比價與發包、付款、帳款、進度、打卡、人資、業主查詢、AI 與社群訊息。

## 技術限制

- 前端維持原生 HTML、CSS、JavaScript；除非使用者明確要求，不導入 React、Vue、TypeScript 或打包工具。
- 主程式是全域函式架構，載入順序不可隨意更動：
  1. `js/core.js`
  2. `js/projects.js`
  3. `js/quote.js`
  4. `js/vendor-punch.js`
  5. `js/hr-marketing.js`
  6. `js/billing-contracts.js`
  7. `js/misc.js`
- 正式樣式檔是 `css/style.css`。
- Netlify 發布目錄是專案根目錄，Functions 在 `netlify/functions/`。
- Firebase Realtime Database 路徑根節點是 `zeju_data/`，前端並以 localStorage 作離線快取。

## 正式檔案與舊檔

- ERP 入口：`index.html`
- 業主頁：`client.html`
- 廠商回報頁：`vendor-report.html`
- 平面規劃：`floorplan.html`
- PWA：`manifest.json`、`sw.js`
- 不要修改 `archive/stale-root-js/`；它只保留舊版參考。
- `root/`、`js/client.html`、根目錄 `style.css`、`js/style.css`、根目錄 `ai-proxy.js`、根目錄 `newebpay-create-period.js` 都可能是歷史副本。除非先證明正式頁面有引用，否則不要把修正寫在這些檔案。
- 正式 Netlify Function 請改 `netlify/functions/` 內的版本。

## 資料操作規則

- 一般 CRUD 一律經過 `DB.get`、`DB.getAll`、`DB.push`、`DB.upd`、`DB.softDel`、`DB.restore`、`DB.del`。
- 不要用 `DB.set` 做一般修改；它會整包覆蓋集合，只能用於備份還原等明確需要整批取代的情境。
- 關聯案場以 `projectId` 為準，`caseN` 僅作舊資料相容與顯示。
- ID 可能是數字或字串，必須用 `sameRecId(a,b)` 比對，不可直接用 `===`。
- 產生 inline JavaScript 的 ID 時使用 `jsId(id)`，可空關聯使用 `recId(value)`。
- 報價總額使用 `quoteGrand(q)`／`calcQuoteTotals(sections)`，不要另寫一套公式。
- 廠商成本／付款使用 `getVendorTrueCost`、`getVendorPaid`、`getVendorRemain`，避免各頁算法不同。
- 寫入跨模組資料後，呼叫既有刷新入口，例如 `refreshLinkedViews`、`refreshVendorViews`、`refreshAccountViews`。
- 所有插入 `innerHTML` 的使用者文字必須經過 `esc()`。

## 不可破壞的業務規則

- 案場詳情的「廠商報價」代表已確定發包，只顯示採用項目。
- 工程／全部廠商是比價池：先依公司顯示，再展開歷史報價；點報價可看工項細節。
- `adopted` 是複選，不可因勾選一筆而自動取消同案場、同工種的其他報價。
- 舊廠商資料若沒有 `adopted` 欄位，現行邏輯視為已發包，避免舊資料消失。
- 廠商付款會同步產生／更新內帳支出；關聯欄位為 `vendorId`、`payRecordId`，不可重複計入案場毛利。
- 案場毛利以 `calcProjectProfit(projectId)` 為唯一公式。
- 打卡案場下拉由 `projects` 產生，並保留 `""`（不指定案場）與 `__office__`（辦公室）。
- 同一天可依不同案場各打一組上下班卡；打卡必須取得定位。
- 員工功能權限必須同時套用在導覽、`showPanel` 與案場子頁，不能只隱藏按鈕。
- 業主頁須相容設計圖 `imgDataUrl`／`fileUrl`／`fileUrls`，進度須相容單筆與 `items[]`、`photoUrl`／`photoUrls`。

## 驗證與完成條件

- 修改前先確認 Git 狀態，不覆蓋使用者或其他代理人的改動。
- 所有改過的 JavaScript 至少執行 `node --check`。
- 本機靜態頁可用 `python3 -m http.server 8765` 測試。
- 涉及 Netlify Functions 時，使用 `netlify dev` 或等價方式測試，不可只測靜態伺服器。
- 改動前端正式檔案後更新 `sw.js` 的 `CACHE_NAME`，確保 PWA 使用者收到新版。
- 測試桌機與手機版，並確認 Firebase 同步後畫面會刷新。
- 專案慣例是 ERP 修正完成後提交並推送 `main` 讓 Netlify 自動部署；提交前排除 `.DS_Store`、環境檔與無關變更，也不要略過 Git hooks。
- 不宣稱「已上線」直到確認遠端 `main` 已包含提交，且正式站實際回傳新版檔案。

## 安全規則

- 不在聊天、文件、提交訊息或新檔中貼出密碼、API 金鑰、Webhook secret、service account 或付款金鑰。
- 前端 Firebase Web 設定雖屬公開識別資訊，也不要在交接文件重複散布。
- 機密只能放 Netlify 環境變數或合適的秘密管理服務；`.env*` 不可提交。
- 現有登入與 Firebase 匿名驗證只是最低限度保護。未經完整遷移與測試，不可自行更換正式驗證流程或資料庫規則。
- 金流改動一律先走測試環境，確認簽章、回呼、重送與冪等性後才能上正式環境。

## 詳細脈絡

開始工作前先讀根目錄的 `CODEX_HANDOFF.md`，其中包含架構、資料集合、環境變數、近期完成項目、風險與接手步驟。
