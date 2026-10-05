# 案場通 Codex 交接文件

最後整理：2026-10-06  
整理時分支：`main`  
整理時最新功能提交：`fd86d1a`  
正式站：`https://zeju.easycase.tw/`  
GitHub：`https://github.com/eve1995927-svg/omnight`

> 本文件刻意不包含任何密碼、API 金鑰、token 或付款憑證。機密值請到 Netlify／服務商後台確認，不要從聊天或文件傳遞。

## 1. 專案是什麼

「案場通」是澤居室內裝修使用的統包 ERP，目標是把裝修案從接洽到完工的資料串在同一個案場：

- 案場總覽與狀態
- 業主／客戶資料
- 試算與正式報價
- 合約與簽署
- 丈量、設計圖、備忘錄、施工進度
- 廠商報價、公司別歷史比價、複選採用、發包
- 廠商分期付款與內帳同步
- 收支、發票、固定支出、月費帳單、財務報表、案場毛利
- 員工、人事、薪資、請假、打卡與定位
- 業主專屬進度頁、廠商回報頁
- AI 報價／OCR／客服／行銷內容
- LINE、Facebook、Instagram、Threads 整合
- Stripe 與藍新定期定額的初步串接

使用者 Hulk 是設計師，偏好直接完成工作並部署。回覆應使用繁體中文，避免只講工程術語。

## 2. 技術架構

### 前端

- 原生 HTML、CSS、JavaScript，沒有 bundler、框架或 TypeScript。
- 主入口是 `index.html`。
- 正式樣式是 `css/style.css`。
- Firebase 9 compat SDK 由 CDN 載入。
- Firebase Realtime Database 是主要資料庫。
- localStorage (`z7_<collection>`) 是快速啟動畫面與離線降級快取。
- PWA 使用 `manifest.json` 和 `sw.js`，採 network-first。

`index.html` 的腳本順序具有依賴性：

1. `js/core.js`：全域設定、角色權限、Firebase、DB、共用 UI、AI 呼叫、導覽
2. `js/projects.js`：儀表板、案場、案場詳情、丈量、設計、備忘錄、毛利、付款
3. `js/quote.js`：報價編輯、金額與稅額公式、匯出相關共用邏輯
4. `js/vendor-punch.js`：廠商報價、付款入口、打卡、定位、部分帳款
5. `js/hr-marketing.js`：進度、人資、薪資、請假、廠商比價、行銷
6. `js/billing-contracts.js`：帳單、合約、帳款與報價的補充功能
7. `js/misc.js`：合約上傳、業主／CRM、打卡日曆、社群訊息、其餘初始化

這些檔案共享全域變數與函式。重構前要先搜尋所有呼叫點，不能只看單一檔案。

### 後端

- 託管與部署：Netlify。
- `netlify.toml` 將根目錄設為 publish，Functions 目錄為 `netlify/functions`。
- Functions 使用 CommonJS。
- 根目錄與 `netlify/functions/package.json` 目前都只宣告 `firebase-admin`。
- AI 前端統一呼叫 `/.netlify/functions/ai-proxy`，由後端讀環境變數再呼叫 Gemini。
- 社群 Webhook／回覆與金流也在 Netlify Functions。

### Firebase

- Realtime Database 正式資料根節點：`zeju_data/`。
- 規則要求 `auth != null`。
- 前端目前使用 Firebase 匿名登入。
- `_cache` 內部統一為 `{ recordId: record }`，`DB.get()` 對外回傳陣列。
- 新增資料用 `Date.now()` 產生 `_id`，並附 `_ts`。
- 一般寫入是逐筆 set/remove，避免多裝置整包覆蓋。
- 每個集合目前上限 500 筆，超過時 `DB.push` 會刪除最舊一筆；這是重要限制。

## 3. 正式入口與檔案地圖

### 正式頁面

- `index.html`：ERP 主系統
- `client.html?c=<project-token>`：業主專屬頁
- `vendor-report.html?c=<project-token>`：廠商回報進度
- `floorplan.html?projectId=<id>`：平面規劃工具
- `signup.html`、`signup-success.html`：訂閱／申請流程

### 正式程式

- `js/*.js`：ERP 主程式
- `css/style.css`：ERP 正式樣式
- `netlify/functions/*.js`：正式 serverless functions
- `firebase-database-rules.json`：RTDB 規則版本
- `sw.js`：PWA 快取

### 不要優先修改的歷史副本

- `archive/stale-root-js/`：已明確封存的舊 JS
- `root/index.html`、`root/client.html`
- `js/client.html`
- 根目錄 `style.css`、`js/style.css`
- 根目錄 `ai-proxy.js`
- 根目錄 `newebpay-create-period.js`
- `zeju_netlify.zip`

以上檔案目前內容與正式版本不完全相同。若要清理，必須另開任務，先查 Netlify 部署設定與外部連結，再刪除；不要在功能修正時順手同步多份。

## 4. 主要資料集合

`js/core.js` 的 `_KEYS` 是前端會同步的集合清單：

- `projects`：案場；核心欄位 `_id`, `name`, `client`, `status`, `address`, `lat`, `lng`, `token`
- `quotes`：對外報價；`projectId`, `caseN`, `sections`, `total`, `type`
- `vendors`：廠商報價／發包；`projectId`, `caseN`, `vendor`, `cat`, `items`, `amount`, `adopted`, `payments`
- `contracts`：合約；`projectId`, `quoteId`, `fileUrl`, `fileUrls`, `status`
- `progress`：進度；`projectId`, `contractId`, `items[]`，也需相容舊單筆格式
- `ledger`：內外帳；`projectId`, `book`, `type`, `amount`, `date`；廠商付款另有 `vendorId`, `payRecordId`
- `invoices`：發票
- `billing`、`monthly_bills`：帳單
- `recurring_expenses`：固定支出
- `employees`：員工、登入帳號、權限、薪資設定
- `punch_recs`：打卡；`user`, `projectId`, `projectName`, `type`, `lat`, `lng`, `addr`
- `punch_requests`：補卡／修改申請
- `salary_records`、`leave_requests`：薪資、請假
- `clients`：客戶／業主
- `measurements`：丈量
- `design_files`：設計檔；需相容 `imgDataUrl`, `fileUrl`, `fileUrls`
- `memos`：案場備忘錄
- `vendor_reports`：廠商回報
- `calendar_events`：行程
- `omnichannel_messages`、`omnichannel_threads`：社群訊息
- `chat_mk`, `chat_cs`, `chat_ac`, `chat_ad`：AI 對話
- `post_history`、`reports`、`zeju_quotes`

### 關聯原則

- `projectId` 是案場關聯的唯一主鍵。
- `caseN` 是案場名稱快照與舊資料 fallback，不應再當唯一關聯。
- `_id` 在舊資料中可能是 number 或 string，使用 `sameRecId`。
- 找不到 `projectId` 的舊資料，可在明確遷移流程中用 `caseN` 對回案場，但不要長期依賴名稱。
- 合約可由 `quoteId` 連回報價。
- 進度可由 `projectId` 直接連案場；舊資料也可能經 `contractId` 間接連回案場。
- 廠商付款的每一期有自己的付款 ID，帳款以 `vendorId + payRecordId` 對應，避免重複。

## 5. 共用函式與公式

修改金額或資料連動前，先使用既有 helper：

- `sameRecId(a,b)`：相容字串／數字 ID
- `recId(value)`：把空值正規化成 `null`
- `jsId(id)`：安全輸出 inline handler ID
- `findRec(key,id)`：集合內依 ID 找資料
- `quoteGrand(q)`：報價總額
- `calcQuoteTotals(sections)`：報價小計、8% 管理費、5% 稅與總額
- `calcItemsTax(items)`：廠商細項含稅／未稅加總
- `getVendorTrueCost(v)`：實際廠商成本
- `getVendorPaid(v)`：付款累計
- `getVendorRemain(v)`：剩餘應付
- `calcProjectProfit(projectId)`：全站案場毛利唯一公式
- `bumpProjectStatus(projectId,status)`：依流程推進案場狀態
- `refreshLinkedViews(projectId)`：跨頁刷新
- `refreshVendorViews()`：廠商、案場廠商、會計刷新
- `refreshAccountViews()`：帳款與儀表板刷新
- `esc(value)`：HTML escape

報價公式目前為：

- 小計：所有工程項目合計
- 管理費：小計的 8%
- 稅：標記課稅的小計加管理費後乘 5%
- 總額：小計 + 管理費 + 稅

這些比率目前寫在程式裡。未經產品確認不要自行改成其他公式。

案場毛利目前定義為：

- 外帳收入
- 減內帳支出（排除廠商付款自動產生的支出）
- 減已採用廠商的實際成本

排除廠商付款內帳是為了避免成本算兩次。

## 6. 角色與權限

- `owner`：完整權限
- `staff`：依員工的 `permissions` 開放 projects／business／vendor／accounting／settings
- `punch`：只顯示打卡

權限不是只控制選單：

- `groupsFor`／側欄決定能看到什麼
- `canAccessPanel`／`showPanel` 防止直接切面板繞過
- `canAccessProjectTab` 控制案場內子頁
- 待辦、搜尋與深連結也不可讓員工繞過權限

目前登入與員工密碼處理仍是舊架構，安全性不足，詳見風險章節。

## 7. 已確認的產品規則

### 廠商與發包

- 「全部廠商／工程」是比價池。
- 比價先列公司，再展開該公司的歷史報價。
- 點歷史報價開細項視窗，顯示工項、數量、單位、單價、稅別與小計。
- 採用是核取方塊並允許複選，不可互斥。
- 案場詳情的廠商分頁只顯示確定發包／採用的項目。
- 舊資料沒有 `adopted` 時視為已發包，避免升級後歷史資料消失。

### 打卡

- 地點包含不指定案場、辦公室與 Firebase 的實際案場。
- 辦公室 sentinel 是 `__office__`。
- 案場同步完成後必須重建下拉，不可只在首次載入時建立。
- 同一天、同一位員工、同一地點各有一組上下班；換案場可再打一組。
- 打卡需要 GPS，並保存案場名稱快照，避免案場後續封存／改名造成舊記錄無法辨識。

### 業主頁

- 由案場 `token` 產生 `client.html?c=...`。
- 可看工程資料、進度、設計圖與合約。
- 設計圖及進度照片要相容新舊欄位格式。

## 8. 近期已完成的修正

由新到舊：

1. 打卡地點改從案場清單載入，保留辦公室／不指定；比價可開細項視窗；採用改複選。
2. 業主頁可讀新舊設計圖與進度格式；員工權限補上待辦與搜尋防繞過；舊根目錄 JS 封存。
3. 案場、報價、合約、發包、帳款統一 ID、金額、狀態與跨頁刷新。
4. 案場廠商頁改成已發包清單；工程頁維持比價池；付款同步會計。
5. 帳單重複與含稅金額修正。
6. 人事成本月份、丈量照片、跨案場報價／合約刷新修正。
7. 手機底欄、頁籤、報價路徑、死連結與上傳流程修正。
8. 公務打卡改為先取得手機定位，沒有座標不能打卡。

不要把上述完成項目重新改回舊行為。

## 9. Netlify Functions 與環境變數

### AI

`netlify/functions/ai-proxy.js`

- `GEMINI_API_KEY`，或
- `GOOGLE_API_KEY`，或
- `GOOGLE_GENERATIVE_AI_API_KEY`

### LINE／Meta／Threads

相關 Functions：

- `line-webhook.js`
- `meta-webhook.js`
- `send-reply.js`
- `line-push.js`
- `lib/firebase.js`

可能使用：

- `LINE_CHANNEL_ID`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `META_PAGE_TOKEN`
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `INSTAGRAM_PAGE_TOKEN`
- `THREADS_ACCESS_TOKEN`
- `THREADS_USER_ID`
- `APP_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT`（僅舊的 `line-push` 路徑需要）

部分社群設定也可從 Firebase 的 `zeju_data/omnichannel_config` 讀取。這個設計目前有安全風險，不要把值輸出到 log 或前端。

### Stripe

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

### 藍新

- `NEWEBPAY_MERCHANT_ID`
- `NEWEBPAY_HASH_KEY`
- `NEWEBPAY_HASH_IV`
- `NEWEBPAY_ENV`：`test` 或 `production`
- Netlify 自帶的 `URL`

金流程式目前屬初步串接。改動後必須在測試環境驗證通知簽章、解密、重送與冪等。

## 10. 開發、檢查與部署

### 本機靜態測試

```bash
cd /Users/yongye/澤居
python3 -m http.server 8765
```

開啟 `http://127.0.0.1:8765/`。

靜態伺服器不會執行 Netlify Functions；要測 AI、Webhook 或付款請使用已安裝的 Netlify CLI：

```bash
netlify dev
```

### JavaScript 語法檢查

```bash
node --check js/core.js
node --check js/projects.js
node --check js/quote.js
node --check js/vendor-punch.js
node --check js/hr-marketing.js
node --check js/billing-contracts.js
node --check js/misc.js
node --check sw.js
```

專案目前沒有正式的自動化測試或 lint script。功能改動需搭配瀏覽器實測。

### PWA

前端正式檔案變更後：

1. 更新 `sw.js` 的 `CACHE_NAME` 版本。
2. 確認 `APP_SHELL` 包含正式入口與腳本。
3. 部署後直接抓正式站 `sw.js`，確認是新版。
4. 手機若仍顯示舊版，關閉重開；必要時清除該站快取。

### Git／部署

```bash
git status
git diff
git add <本次相關檔案>
git commit -m "清楚描述使用者可感受到的改動"
git push origin main
```

Netlify 由 GitHub `main` 自動部署。推送後要確認：

- `origin/main` 與本機提交一致
- 正式站檔案確實出現新版內容
- 不要提交 `.DS_Store`、`.env*`、金鑰或無關檔案

## 11. 已知風險與技術債

依優先級排列：

### P0：身份驗證與資料授權

- 主系統仍有前端硬編碼角色帳號資料。
- 員工密碼存在應用資料中，沒有成熟的身份服務與密碼雜湊流程。
- Firebase 規則只要求匿名 `auth != null`；任何能取得匿名 token 的人理論上可存取資料。
- 業主／廠商 token 是分享連結，不等於完整權限模型。

建議未來以 Firebase Auth email/password 或 custom claims 重做身份，資料庫規則依公司／角色／案場限制。這是資料遷移與驗證專案，不要當成小修直接上線。

### P0：敏感社群設定

- `omnichannel_config` 可存在目前相同 Firebase 節點。
- 在匿名驗證架構下，這不適合長期保存高敏感 token。

應遷移到 Netlify 環境變數或伺服器端秘密管理，前端只保存非敏感設定。

### P1：圖片與檔案存在 RTDB

- 大量照片／PDF 以 base64 或 data URL 放在資料記錄中。
- 會造成 RTDB 容量、流量、同步速度與瀏覽器記憶體問題。

先前已明確暫不做 Firebase Storage。若重新啟動此項，需設計上傳、權限、舊資料遷移及回滾，不可只改新檔案。

### P1：集合 500 筆上限

- `DB.push` 超過 500 筆會直接刪最舊資料。
- 對帳款、打卡、訊息、歷史紀錄等長期資料可能造成不可接受的遺失。

應改為分頁／索引／按年份封存，不應靠靜默刪除。

### P1：沒有自動測試

- 無單元測試、整合測試、lint、schema 驗證。
- 全域函式與載入順序使回歸風險較高。

最低限度應建立：金額公式測試、DB 關聯測試、角色權限測試、廠商付款冪等測試、打卡分組測試。

### P2：重複與歷史檔案

- 專案仍有多份 HTML、CSS、Function 歷史副本與 zip。
- 容易讓代理人改錯檔。

待確認外部引用與 Netlify 發布內容後，可另案刪除或移到 `archive/`。

### P2：全域命名與重複 helper

- 多個 JS 共用 global scope。
- `sameRecId` 等 helper 有重複定義。
- 改載入順序或單獨載入某檔容易出錯。

未來可逐步模組化，但需保持現有頁面與 inline handler 相容。

### P2：公式寫死

- 管理費 8%、稅率 5% 等邏輯寫在程式中。
- 公司設定雖有顯示值，不一定是計算的唯一來源。

若要產品化給其他公司，應先建立帶版本的設定與計算規則。

## 12. Codex 接手時的第一輪動作

1. 讀 `AGENTS.md` 與本文件。
2. 執行 `git status`，不要覆蓋未提交改動。
3. 讀使用者點名功能的正式檔案，並搜尋所有同名函式／DOM ID。
4. 確認資料欄位的新舊格式與跨頁刷新需求。
5. 先做最小修正，不做未要求的框架重寫。
6. 執行所有修改檔的 `node --check`。
7. 用本機瀏覽器驗證桌機與手機版。
8. 如果是正式 ERP 修正，更新 PWA cache、提交、推送並確認正式站。

## 13. 可直接貼給 Codex 的起始提示

```text
請先完整閱讀根目錄 AGENTS.md 與 CODEX_HANDOFF.md，再開始處理。

這是澤居「案場通」ERP，正式站是 https://zeju.easycase.tw/，GitHub main 推送後由 Netlify 自動部署。前端維持原生 HTML/CSS/JavaScript，不要導入框架。正式主程式只改 index.html、css/style.css、js/*.js、netlify/functions/*.js；archive/stale-root-js 與其他歷史副本不要改。

工作時請遵守：
1. 先檢查 git status，不覆蓋現有改動。
2. 資料 CRUD 經 DB helper；projectId 是主關聯；ID 用 sameRecId。
3. 報價、成本、付款、毛利使用既有共用公式，不另寫一套。
4. 採用允許複選；案場廠商頁只顯示已發包；廠商付款要與 ledger 保持同步。
5. 角色權限要防止直接導覽、搜尋或深連結繞過。
6. 不顯示或提交任何密碼、token、API key。
7. 改完執行 node --check、瀏覽器實測、更新 sw.js cache 版本。
8. 完成正式修正後提交並推送 main，再確認正式站取得新版。

我的本次需求是：
[把需求貼在這裡]
```

## 14. 交接完成判定

Codex 能只靠儲存庫內以下兩份檔案開始工作：

- `AGENTS.md`：每次都要遵守的規則
- `CODEX_HANDOFF.md`：專案全貌、資料關係、部署與風險

遇到與本文件衝突的最新使用者指示，以最新明確指示為準；涉及資料破壞、安全或付款時，先說明風險再動手。
