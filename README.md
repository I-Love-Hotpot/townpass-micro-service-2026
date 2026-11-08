# 白話人｜文件閱讀微服務

開發團隊：**拖把吃火鍋又不揪**。實作內容更新：2026-11-08。

白話人將照片或 PDF 整理為白話摘要、六何資訊與自然語言問答，並附上實際引用的法規／FAQ 參考資料。本 repository 提供 Vue 介面、文件處理編排、資料保存與離線網站；iPhone OCR、Gemma 引擎及本機檢索位於 [TownPass Flutter 專案](https://github.com/I-Love-Hotpot/TownPass)。兩個專案請搭配目前 `main` 使用。

正式網站：[townpass.fearnot.tw](https://townpass.fearnot.tw)。一般瀏覽器可預覽介面，真實文件辨識與模型生成需要 Flutter Native host。

## 現有功能

| 功能 | 目前行為 |
| --- | --- |
| 文件輸入 | 相簿、連續拍照、多張累積、排序／移除，或 PDF 逐頁轉圖 |
| 四角裁切 | 照片可手動開啟，支援自動找角、拖曳放大鏡、旋轉及透視校正；不強制先確認才能辨識 |
| OCR | 逐頁呼叫 iPhone Apple Vision，保留逐頁狀態與可人工校正的完整原文 |
| 分段結果 | 第一通生成摘要與六何，先顯示結果；第二通接著產生建議問題及回答 |
| 六何 | 何人、何事、何時、何地、為何、如何；缺漏可呈現未提及，不自行補造事實 |
| 你可能想問 | 依情境自然生成零至三題，不強制三題或固定句型；回答用白話語言，法條作為輔助 |
| RAG 引用 | 本機檢索最多三筆候選，每題只顯示實際引用的證據；保留多筆參考與引用全文 |
| 情境提醒 | 可顯示模型提供的合理性疑點，例如區分未成年駕駛與乘客；不阻擋結果也不代表已確認錯誤 |
| 後續閱讀 | 重新解釋、人工追問、複製、逐頁圖片及歷史紀錄 |
| 儲存 | IndexedDB 保存原檔、頁面、OCR、摘要、六何、問答與引用，支援刪除文件 |
| 離線網站 | 完整版本 Service Worker 快取、下載驗證、版本顯示、更新失敗保留舊版 |
| 使用回饋 | 詳情底部提供有幫助／沒有／內容有誤選項；目前僅頁面狀態，尚未持久化或上傳 |

文件頁已移除「下一步」、「查找相關服務」與「查看我的申辦案件」入口。AI 輸入／輸出 Guard 及自訂張數、檔案大小、頁數、原文字數門檻已移除；實際解碼、通訊、儲存、取消及模型執行錯誤仍會顯示。大量或長篇文件仍受裝置記憶體、模型上下文與處理時間影響。

## 架構與資料流

```text
Vue 選檔 → PDF 轉圖／照片 → govclearNative.transcribe → iPhone Apple Vision
  → OCR 原文 → generate（摘要＋六何＋可選提醒）→ 顯示初步結果
  → retrieve（最多三筆本機候選）→ generate（問題＋回答＋引用）
  → IndexedDB 保存 → 詳情、重新解釋與追問
```

- Flutter 使用 LiteRT-LM／Gemma 4 E4B 在手機推論，沒有把文件送到 Fastify 或遠端模型 API。網站資源更新仍需要網路。
- `govclearRag.ts` 編排兩通模型，`what/how` 用於檢索；手動追問也使用原文及相關參考資料。
- Flutter 知識庫有 1,135 筆資料，以詞彙檢索召回。推論用相關完整段落節省上下文，引用保存／顯示完整原文與來源 metadata；不是向量搜尋或已驗證的法規適用性判定。
- 解析器相容欄位別名、程式碼框及可恢復的完整 JSON 列。部分生成失敗會呈現未完成原因與重試入口，不因格式缺漏丟掉 OCR；同原文重新解釋保留未被成功更新的既有有效結果。
- 取消、逾時或離開頁面會終止相關工作；成功請求的 `dispose` 不多送一次 Native cancel，避免干擾下一通生成。

專用通訊物件為 `window.govclearNative`，訊息為 `{ name: 'govclear', data: { id, action, payload } }`，提供 `check`、`transcribe`、`generate`、`retrieve`、`summarize`、`sixQuestions`、`cancel`。`flutterObject` 的通用分享／外部連線 composable 與此文件橋接分開。

## 專案目錄

| 路徑 | 責任 |
| --- | --- |
| `frontend/src/views/ScanView.vue` | 輸入、裁切入口、逐頁 OCR、進度與初步結果 |
| `frontend/src/views/DocumentView.vue` | 原文、摘要、六何、問題、引用與追問 |
| `frontend/src/services/govclearRag.ts` | 兩階段生成與引用解析 |
| `frontend/src/services/govclearBridge.ts` | Native 請求、回應、取消與生命週期 |
| `frontend/src/services/records.ts` | IndexedDB 文件／卡片交易與保存 |
| `frontend/src/components/molecules/DocumentCrop.vue` | 四角範圍編輯介面 |
| `frontend/build/offline.mjs` | 完整發布版本的離線快取產生器 |
| `frontend/tests/` | 單元與瀏覽器驗證工具 |
| `backend/` | Fastify、MariaDB/MySQL 連線池、健康檢查與 Swagger |
| `native/govclear/` | Flutter 配套 patch、資料整合與歷次實機驗證紀錄；實際原生程式以 TownPass main 為準 |
| `vendor/CityBridgeFlutterEngine_v0_1_0/` | 匯入資料、來源／權利聲明及參考實作 |
| `local-inference/` | 電腦端 Ollama 原型、Python 準備工具與測試；手機不需要 Python runtime |
| `docs/` | 契約、設計及歷次驗證紀錄 |

## 前端開發

使用 Node.js 22.13+ 與相容 lockfile v9 的 pnpm。Cloudflare Pages 設定使用 Node 22、pnpm 11.25.0；以 [Pages 設定文件](docs/cloudflare-pages.md) 為準。

從 repository 根目錄執行：

```sh
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev:local
```

開啟 [localhost:3000](http://localhost:3000/)。`dev:govclear` 固定使用 `127.0.0.1:5173`，供開發整合；iPhone 正式 host 預設使用受信任 HTTPS 網站，不會自動連上本機 Vite。

```sh
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
```

`test` 執行 `tests/*.test.mjs`；`build` 包含型別檢查與正式打包。瀏覽器 harness 的模擬 Native 回應不代表真機 OCR／模型驗證。正式 build 不包含工作區外的開發範例文件，獨立 clone 可從空紀錄開始。

### iPhone 配套

將本專案與 Flutter `TownPass` 放在相鄰目錄，先完成 Xcode 簽章與 Bundle ID 設定，再連接解鎖的 iPhone：

```sh
python3 local-inference/prepare_iphone.py --app ../TownPass
```

這是電腦端安裝工具，會驗證並下載約 3.66 GB 的固定 Gemma 權重、建置 Profile App、安裝 App 並將模型複製到手機 Documents。多台裝置時加 `--device <UDID>`。實際使用不需啟動 Mac Ollama 或 Python 服務；詳細原生環境及測試入口見 [Flutter README](https://github.com/I-Love-Hotpot/TownPass#readme)。

## 本機保存與離線更新

IndexedDB `baihua` 保存 `documents`、`cards`、`settings`，依瀏覽器／WebView 與網站來源隔離，目前沒有後端文件同步 API。清除網站資料會影響本機紀錄；不同網域或舊 localhost 來源的資料不會自動遷移。

首次連網開啟會下載完整網站資產，包含 PDF worker、CMap、字型與 WASM，逐檔驗證成功才安裝。等待「完整離線版本已備妥」後可關閉再離線重開；模型需另外安裝，Service Worker 不下載權重。

版本以內容雜湊識別；開啟、恢復網路、回到前景及前景每五分鐘檢查更新。新版完整下載後，等待目前服務頁關閉再啟用；失敗保留舊版。清除快取或系統回收後需重新連網下載。

## Fastify 與 Docker

後端保留基礎服務，目前沒有文件 OCR、摘要、文件雲端儲存、繳費、圖書館或市府申辦 API。

| 端點 | 行為 |
| --- | --- |
| `GET /`、`GET /health` | 執行資料庫 `SELECT 1`；正常 200，資料庫不可用 503 |
| `OPTIONS /health` | 檢查允許來源與 GET 預檢 |
| `/api-docs`、`/api-docs/swagger.json` | Swagger UI 與靜態規格 |

開發容器：

```sh
cp .env.example .env
# 編輯 .env，設定資料庫帳密及允許來源。
docker compose up -d
```

前端 `localhost:3000`、後端 `localhost:3001`、Adminer `localhost:3002`；MariaDB 11 僅在容器網路中提供 3306，資料放在 `data/db`。不要將 `.env`、資料庫內容或私人文件提交 Git。

後端可在 `backend/` 執行 `npm install`、`npm run dev`，但仍需可連線的資料庫及該工作目錄的環境變數。後端目前沒有 `npm test` script。其他服務／資料庫部署設定保留於 `docker-compose.prod.yaml` 與 `docker-compose.db.prod.yaml`，與下方網站 Pages 部署分開。

## 正式網站部署

正式網站唯一發布來源為 GitHub **`main` 自動部署**，其他分支由 Git 產生 Preview。Cloudflare Pages 專案 `townpass` 的 root 為 `frontend`、build 為 `pnpm build`、output 為 `dist`。

不使用 Wrangler／Direct Upload 手動發布本機 `dist`。部署失敗應修正 Git 提交並重新觸發；完成後確認 Pages commit 與 GitHub main 相符。設定與核對方式見 [Cloudflare Pages 自動部署](docs/cloudflare-pages.md)。

純網頁變更會經網站與離線更新機制送達；Flutter 原生橋接、知識庫或 App 設定改動需要另行建置安裝。GitHub 的前端 release workflow 用於打包產物，不取代 Pages 的 Git 自動部署。

## 驗證紀錄與已知限制

2026-11-08 合成短通知在 iPhone 真實正式 WebView 的既有測試：第一份摘要 **7.034 秒**，按下辨識至摘要、六何與三組問答全部排版 **17.315 秒**，含三筆不同引用。範圍包含真實 OCR、模型、保存與畫面；不包含選圖前及首次網站下載，也不代表每張照片、長文件或裝置狀態都能在 20 秒內完成。

- [完整測試結果](native/govclear/validation/webview-e2e-iphone.json)
- [摘要畫面](native/govclear/validation/webview-e2e-summary.png)、[問答畫面](native/govclear/validation/webview-e2e-questions.png)
- [RAG 與效能演進](docs/govclear-rag-guard.md)
- [裁切功能設計](docs/document-corners.md)

這些是歷次驗證，不表示本次文件更新重跑實機。模型可能產生不精確內容；知識庫候選資料與詞彙召回不代表法律適用性或引用正確性已驗證，沒有 AI Guard 複核。

部分較早的 `docs/` 與 `frontend/README.md` 仍描述舊分支、舊輸入門檻或舊生成流程；目前實作總覽以本 README 與程式為準，歷史文件用於追溯。

## 授權

Copyright (C) 2026 拖把吃火鍋又不揪

本團隊自行開發且有權授權的程式碼採用 **GNU Affero General Public License v3.0 only**（`AGPL-3.0-only`），正式全文見 [LICENSE](LICENSE)。允許商用，須遵守適用的原始碼提供與聲明保留等義務，不附加「商用需另行同意」限制。

既有上游、其他貢獻者、第三方套件、模型權重、資料與素材保留各自條款與署名；本聲明不將它們重新授權。TownPass 原有 GPL v3 不變。發布者應提供對應實際部署版本的原始碼及必要建置資料；公開原始碼不包含密碼、金鑰或使用者私人文件。

競賽要求的公開 repo 期間與標準授權分開處理，不代表授權於一年後到期。本次文件更新不表示已完成所有依賴與發行物的授權稽核。
