# 專案架構與開發導覽

更新日期：2026-11-08。本文依目前工作區程式整理，包含尚未提交的變更；不代表已部署版本。

## 專案定位與邊界

本 repository 是 TownPass「白話人」微服務：將照片或 PDF 轉為文字，提供白話摘要、六何整理、追問與重新解釋。

- `frontend/` 是 Vue 網頁，嵌入 TownPass Flutter WebView，也可用瀏覽器預覽。
- 文件 OCR 與推論透過 `govclearNative` 呼叫裝置端 host，不經 Fastify 或遠端推論 API。Flutter／Swift host 與手機模型引擎位於另一個 TownPass repository。
- 文件紀錄保存在瀏覽器 IndexedDB；目前沒有後端文件同步或市府申辦 API。辦理狀態與服務跳轉仍含示意資料。
- `backend/` 保留 Fastify、資料庫連線、健康檢查與 Swagger 文件；不是文件辨識服務。
- `local-inference/` 提供電腦端 Ollama CLI 原型及外部 Flutter 專案的模擬器／手機準備腳本。

根目錄 `README.md` 含原始通用微服務範本描述。判斷現有功能時，以程式、`frontend/README.md` 與 `docs/integration-main-offline.md` 為準，勿將舊版地圖、繳費等範例視為已實作功能。

## 目錄

```text
frontend/
  src/
    main.ts / App.vue       Vue 啟動、共用版面與離線狀態
    router/index.ts         Hash 路由
    views/                  掃描、紀錄、文件詳情、設定
    components/             atoms / molecules / organisms 元件
    stores/workspace.ts     Pinia：環境、紀錄卡片、初始化與處理狀態
    interfaces/document.ts  文件、摘要、語言與應用環境型別
    services/               文件處理、Native Bridge、保存與顯示資料
    composables/            通用 Flutter 訊息收發
    assets/govclear/        摘要、手機摘要、核對、六何提示詞
    css/                    全域樣式
  build/offline.mjs         建置完整版本 Service Worker 快取
  tests/                   Node 測試及瀏覽器測試工具
  vite.config.ts           PDF 資產、開發範例檔、離線建置
backend/
  src/app.js               Fastify 啟動、CORS、路由與關閉清理
  src/routes/              health.routes.js / docs.routes.js
  src/services/            database.service.js：MySQL 連線池
  api-docs/swagger.json     靜態 API 規格
local-inference/
  govclear.py / serve.sh    本機 Ollama 推論 CLI 與服務啟動
  prepare_simulator.py     準備模擬器整合環境
  prepare_iphone.py        準備模型與外部 iPhone App
  smoke.py / tests/        模型煙霧測試與 Python 單元測試
  examples/                合成文件範例
docs/                      整合契約、功能設計與歷次驗證紀錄
docker-compose*.yaml       開發環境、正式服務、正式資料庫
.env.example               環境變數範本
```

## 前端模組與資料流

技術：Vue 3、TypeScript、Vite 5、Pinia、Vue Router、Tailwind CSS、PDF.js。`@/` 對應 `frontend/src/`。

| 入口／模組 | 責任 |
| --- | --- |
| `views/ScanView.vue` | 選檔、連拍累積、排序、OCR 校正與開始處理 |
| `views/HistoryView.vue` | 紀錄清單 |
| `views/DocumentView.vue` | 摘要、原文、頁面、六何、追問與重新解釋 |
| `views/SettingView.vue` | 設定與本機資料操作 |
| `services/files.ts`、`renderPdf.ts`、`documentCrop.ts` | 檔案驗證、逐頁轉圖及裁切 |
| `services/offline.ts` | 串接辨識、摘要、六何與追問；不是 Service Worker 模組 |
| `services/govclearImages.ts` | 照片限制、逐頁辨識狀態及文字合併 |
| `services/govclearDocument.ts` | 原文驗證、推論生命週期與摘要請求 |
| `services/govclearBridge.ts` | Native 連線、請求識別、回應、逾時與取消 |
| `services/govclearSummary.ts`、`govclearSixQuestions.ts` | 模型輸出解析與驗證 |
| `services/records.ts` | IndexedDB 讀寫、交易、刪除及範例匯入 |
| `services/processing.ts` | 處理進度、取消與內容雜湊 |
| `services/context.ts`、`i18n.ts` | URL／系統語言、嵌入環境與介面文案 |
| `services/catalog.ts`、`fixtures.ts`、`answers.ts` | 範例資料與舊範例紀錄的回答行為 |
| `build/offline.mjs`、`components/organisms/OfflineStatus.vue` | 網站完整離線版本建置與下載狀態 |

主要流程：

```text
照片／PDF → 驗證與逐頁圖片 → Native transcribe → OCR 原文／人工校正
  → Native summarize → 解析摘要 → IndexedDB 保存 → Native sixQuestions
  → 文件詳情（重新解釋／追問沿用原文）
```

- 照片最多 5 張，單張 20 MiB、合計 50 MiB；PDF 一份，25 MiB、最多 50 頁。合併原文上限 6,000 字，不以截斷繞過限制。
- Native 訊息格式為 `{ name: 'govclear', data: { id, action, payload } }`；動作為 `check`、`transcribe`、`summarize`、`sixQuestions`、`cancel`。追問沿用 `summarize`，不是額外聊天 API。
- `composables/useConnectionMessage.ts` 與 `useHandleConnectionData.ts` 使用通用 `flutterObject`，與文件推論的 `govclearNative` 分開。
- IndexedDB 資料庫為 `baihua`、版本 1，包含 `documents`、`cards`、`settings`。資料依網站來源隔離；更新文件時須維持文件及卡片一致、取消與失敗不得覆寫有效結果。
- 瀏覽器沒有 Native host 時只能預覽；不得用範例結果冒充真實辨識。

路由使用 hash：`/`、`/history`、`/setting`、`/documents/:id`，文件另有 `pages/:page`、`chat`、`services/:destination`。`/govclear` 支援嵌入入口。`header=1` 顯示網頁頁首；預設由原生提供頁首。語言與嵌入參數由 `readAppContext` 統一處理。

## 離線與部署

- 正式 build 產生 `frontend/dist/` 及 `sw.js`，快取完整發布版本，包含 PDF worker、CMap、字型與 WASM；下載驗證成功才安裝，失敗保留上一個完整版本。Vite 開發模式不註冊此快取。
- 網站快取與 IndexedDB 文件紀錄用途不同；清除網站資料會影響離線使用與本機紀錄。網站快取不包含模型權重。
- PDF 資產平放於 `dist/assets/`，worker 使用 `.js` 副檔名，維持原生 host 資產與 MIME 相容性。
- 開發範例來自 repository 外的 `../docs/idea/papers/`，僅限本機存取，不包入正式 build；獨立 clone 缺少範例仍應正常運作。
- 目前整合文件記載網站透過 Cloudflare Pages 手動部署。實際部署指令與 App 設定見 `docs/integration-main-offline.md`；此文件不驗證線上狀態。

## 後端與 Docker

Fastify 5 使用 `mysql2` 連線池連接 MariaDB 11，監聽 `0.0.0.0:3001`。

- `GET /`、`GET /health` 執行 `SELECT 1`，成功回傳 200，資料庫不可用回傳 503。
- `OPTIONS /health` 驗證允許來源及 GET 方法。
- `/api-docs` 提供 Swagger UI，`/api-docs/swagger.json` 提供規格。
- 環境變數以 `.env.example` 及 `database.service.js` 為準。後端直接啟動只載入目前工作目錄的 `.env`；根目錄 `.env` 由 Docker Compose 注入。
- 開發 Compose：前端主機埠 3000 → 容器 5173、後端 3001、Adminer 3002；資料庫保存在 `data/db`，未映射主機 3306。
- 正式服務與資料庫分別由 `docker-compose.prod.yaml`、`docker-compose.db.prod.yaml` 管理，共用外部網路 `townpass-db`；正式資料庫使用 named volume。

## 開發與驗證指令

前端使用 Node.js 22.13+、pnpm 10；以下從 repository 根目錄執行：

```sh
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev:local       # 127.0.0.1:3000
pnpm --dir frontend dev:govclear    # 127.0.0.1:5173，供原生整合
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build          # 包含型別檢查與正式打包
PYTHONPATH=local-inference /usr/bin/python3 -m unittest discover -s local-inference/tests -v
```

`pnpm test` 執行 `tests/*.test.mjs`；瀏覽器測試檔不包含在此 glob。`node frontend/tests/browser-harness.cjs` 提供本機模擬 Native 回應的測試介面，不能作為真機 OCR／模型品質驗收。

完整開發服務：先依 `.env.example` 建立根目錄 `.env`，再執行 `docker compose up -d`。後端也可在 `backend/` 執行 `npm install`、`npm run dev`，但需另外提供資料庫及環境變數。後端目前沒有 `test` script。

手機準備入口為 `python3 local-inference/prepare_iphone.py --app /absolute/path/to/TownPass-release-checkout`，會下載模型並安裝 App；不是一般文件或前端修改的驗證步驟。

## 修改時的檢查範圍

- 調整資料模型：同步檢查 `interfaces/document.ts`、IndexedDB 交易、store、讀取頁面、範例與相關測試，保留舊紀錄相容性。
- 調整 Native 操作：同步檢查 bridge、呼叫端、提示詞、解析器與測試；外部 host 契約不可只改網頁端。
- 調整檔案／PDF／離線建置：檢查大小與格式限制、取消清理、資產路徑、worker MIME、快取更新及對應測試。
- 私人原文、模型權重、憑證與推論輸出不得加入 Git；不要將本機推論改成共用後端上傳。
- 依修改範圍執行檢查，區分單元測試、模擬 Native、真機測試；歷次驗證文件不代表本次已通過。

延伸閱讀：`docs/integration-main-offline.md`、`docs/govclear-webview.md`、`docs/govclear-iphone-offline.md`、`docs/govclear-summary.md`、`docs/document-corners.md`、`local-inference/VALIDATION.md`。

## 2026-11-08 本機 RAG 與分段結果更新

新文件改走 services/govclearRag.ts：第一通只生成摘要／六何，立即預覽；由 what/how 檢索一段完整本機證據，第二通一起生成具體情境問題與回答。govclearJson.ts 僅處理 JSON／雜湊；依使用者最終指示，所有 AI Guard 已移除，不可將生成結果稱為已複核。文件頁已移除「下一步」及服務／申辦案件入口，重新解釋也可先顯示摘要。

Flutter 的 generate／retrieve 沿用手機既有模型與資料，不需要 Python runtime。資料及可重套 patch 在 native/govclear/，實機測速與限制見 docs/govclear-rag-guard.md 最新章節。單張短通知的原生測試不能當作所有圖片端到端 20 秒保證；不要沿用本檔較早的保存／六何流程或護欄描述作為最新行為。

情境合理性提醒由第一通模型一起產生 optional logicNotes，包含原文引句及需釐清事項；摘要／追問帶入不確定性，不能當作已確認錯誤。角色、年齡、日期先分清，14歲乘客與成人駕駛不應被當作14歲駕駛。提醒不阻擋OCR、生成或保存，舊紀錄缺欄位仍可讀取。

摘要格式相容更新：generate的s/w也接受summary/sixQuestions，JSON可有程式碼框或前置說明；解析缺漏只標記partial，不丟掉OCR或中止後續問答。sixQuestions可不存在，此時不是六欄null／「未提及」；不要在進詳情時自動重跑已有analysis的缺漏結果。同原文重新解釋未回傳的摘要與六何保留舊值。

建議問答接受a/questions/answers及q/question、t/answer；截斷批次僅保留完整JSON列，不補寫答案。questionError保留未完成原因，缺答案的問題仍可顯示；同原文重新解釋若生成失敗且沒有新問題則保留既有問答。詳情即使舊紀錄無analysis也顯示問答區與手動重試入口；重試沿用原文，不做OCR，會重新執行兩通生成，不能宣稱只重跑問答。

建議問答依實際需要最多三題：0～3題皆可為完整結果；不湊滿、不因不足三題標記partial。有效a:[]表示無合適問題，與生成錯誤分開；同原文僅在questionError且沒有新題時保留舊題，不覆蓋模型明確的空陣列。
