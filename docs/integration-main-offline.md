# main 前端 × iPhone 離線處理整合

## 來源

- 前端基底：`main`，`8162b5037eb64465932a7ccb75f08411166b075d`。
- 處理核心：`release/govclear-iphone-offline`，`9a0821fd5a884df321c62f0352a9929584caa347`。
- `backend/` 在這兩個版本完全相同，原樣保留。文件辨識走 `govclearNative`，不是 Fastify HTTP API。
- Flutter host 請使用 [TownPass release/govclear-iphone-offline](https://github.com/I-Love-Hotpot/TownPass/tree/release/govclear-iphone-offline)。微服務 repo 不包含 Swift 模型引擎。

## 整合範圍

保留 main 的掃描、紀錄、詳情、追問、設定、配色、字體及 hash 路由。
照片與 PDF 轉成逐頁圖片，依序透過 release 的 `transcribe` 取得 OCR，合併完整原文，
再使用 `summarize` 產生白話摘要。摘要規則及解析器沿用 release；手機單輪、模擬器長文核對由原生 host 決定。
合併文字上限 6,000 字，超過即報錯，不截斷，也不以範例摘要替代。

IndexedDB 沿用原本 schema，新增可選 `source` 保存 OCR，供重新解釋與追問使用。
既有範例紀錄仍可讀取；沒有 OCR 原文的舊紀錄維持原有範例行為。
追問沿用 `summarize` 操作，以問題專用規則要求根據原文回答；這不是 release 額外提供的聊天 API。
取消與逾時會停止 Native 請求，失敗或取消不覆寫已保存的摘要。
已在 main 樣式中接回 release 的三項功能：

- 多張連拍：`capture="environment"` 拍照累積，相簿可混合追加；按「拍好了」才開始辨識。沿用 release 上限 5 張、單張 20 MB、合計 50 MB，支援排序及移除。取消選圖保留已選照片。
- OCR 人工校正：逐頁顯示辨識文字。部分辨識失敗保留其他結果；修正後重試不重新辨識已完成頁面。詳情也能修改合併原文，修改期間隱藏舊摘要與六何，重新產生成功才保存新原文；舊追問同時清除。
- 六何整理：先保存並顯示摘要，再呼叫 `sixQuestions`，沿用 release 的提示詞與嚴格解析器。支援重新整理及複製；失敗或取消保留已完成摘要與先前有效六何。null 顯示「原文未提及」，缺欄、空字串及截斷 JSON 當錯誤。

微服務頁首由 TownPass repo 的原生 `TPAppBar` 提供（56px、置中「白話人」、網頁返回與離開服務）。網頁預設不顯示頁首；僅 `header=1` 可開啟原有的瀏覽器預覽列。
申辦連結與辦理狀態仍是 main 的示意，沒有新增市府申辦 API。

## 執行

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm dev:local
```

瀏覽器可預覽 main 畫面與既有紀錄。沒有 Native Bridge 時選檔會顯示需要從 TownPass 開啟，不會偽造辨識結果。
模擬器使用 `pnpm dev:govclear`，位址 `http://127.0.0.1:5173/govclear`，搭配 release 的 Flutter host 與模型設定。

手機打包：

```sh
python3 local-inference/prepare_iphone.py --app /absolute/path/to/TownPass-release-checkout
```

這個命令會下載約 3.66 GB 模型並安裝 App；不再將前端複製到 `assets/govclear`。介面由 App 首次連上線上網站後下載完整版本。
請使用獨立的 release checkout。腳本會在下載與覆寫前檢查原生 host 路徑，避免覆蓋其他架構的 Flutter 專案。
本次整合未執行手機安裝或模型下載。
PDF 字型、CMap、WASM 與 worker 會平放在 `dist/assets/`，符合 release host 的資產白名單與 Flutter 打包規則。
worker 輸出 `.js`，符合 release host 的 JavaScript MIME。

## 驗證

```sh
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
PYTHONPATH=local-inference /usr/bin/python3 -m unittest discover -s local-inference/tests -v
```

Node 測試涵蓋 Native Bridge、原文／多頁順序、字數上限、摘要解析、取消、失敗清理及 IndexedDB 交易。
瀏覽器流程以模擬 Native 回應驗證照片、兩頁 PDF、重新解釋、失敗保留、追問與重整後讀取。
模擬回應只驗證串接，不能當作 Apple Vision／E4B 真機品質、效能或離線驗收。
`docs/govclear-*.md` 與 `local-inference/VALIDATION.md` 為 release 原有紀錄，並非本次 main 介面的真機測試結果。

本機 Python 3.14 的 pyexpat 有動態連結錯誤；本輪 Python 測試使用 macOS `/usr/bin/python3` 通過（12 項）。
前端 29 項測試、Lint、型別檢查與 production build 通過。

## 固定公開預覽

網址：<https://townpass.fearnot.tw>，由 Cloudflare Pages 專案 `townpass` 提供服務，備用網址為 <https://townpass.pages.dev>。
公開內容是 `frontend/dist`；本機 Native 測試替身不會進入正式打包或公開網址。

```sh
cd frontend
pnpm build
CLOUDFLARE_ACCOUNT_ID=786dcef12567e51b3a85a4e9a32860d9 npx wrangler@4.158.0 pages deploy dist --project-name townpass --branch main
```

部署使用已登入的 Wrangler，憑證不加入 Git。這是手動 Direct Upload，修改程式後需重新 build 與部署，沒有 Git 自動部署。
2026-11-08 起，網域 CNAME 指向 `townpass.pages.dev`，不再依賴 Mac、preview 或 `townpass-demo` Tunnel。原 Tunnel 目標為 `fefbfcb4-fe68-4dff-8889-55acc1ccd51c.cfargotunnel.com`，僅供回復設定參考。
公開瀏覽器可以累積選圖與查看操作；實際 Apple Vision OCR／E4B 摘要與六何仍需 Native host。

本機瀏覽器回歸可另開標準庫測試伺服器：

```sh
node frontend/tests/browser-harness.cjs
```

只綁定 `127.0.0.1:3010`，以明確標示的測試控制模擬 Native 回應。已驗證連拍累積、相簿混合追加、排序移除、部分 OCR 失敗保留、人工校正金額、摘要與六何接續、六何格式錯誤／取消保留、複製與重整保存。
這些不是實體相機或模型品質驗收。

文件處理中顯示已用秒數，完成後保存本次處理耗時；六何另行計時。取消或離開頁面時停止計時器，重整後仍可查看已保存的完成耗時。時間包含 Native 連線與畫面進度流程，不等於純模型解碼時間。


## 線上首次下載與離線快取（2026-11-08 更新）

已移除 App 的 localhost HTTP server 與打包頁面備援，App 一律載入相同 HTTPS 來源。
正式前端 build 會產生 `sw.js`，列出完整發布內容（包含動態載入程式、PDF worker、CMap、字型及 WASM），並以內容雜湊區分版本、以 SRI 驗證下載內容。開啟頁面後自動下載全部檔案，全部成功才安裝該版 service worker；失敗刪除未完成版本並保留舊版。
頁面上方顯示下載中／離線備妥／失敗重試狀態。首次下載完成後，關閉頁面再斷網重新開啟，可從相同網址載入快取；語言 query 與 hash 路由不會建立另一份頁面快取。
更新下載完成後等待現有頁面關閉再啟用，避免新舊程式混用。新發布內容需完整部署至網站，App 也需重新打包安裝新的 WebView 設定。

iOS 使用持久 WebView 資料及 App-Bound Domains。`Info.plist` 目前允許 `townpass.fearnot.tw`、既有服務的 `taipei-pass-service.vercel.app`、`tp.dstw.dev`。自訂 `GOVCLEAR_URL` 時需同步調整白名單。其他外部網頁不提供原生橋接。
清除網站資料、移除 App 或系統回收網站快取後，需要重新連網下載；Service Worker 快取不是不可刪除的 App 文件。原本 localhost 來源的 IndexedDB 不會自動搬到 HTTPS 來源。
模型仍需先安裝到裝置，這次下載的是完整網站版本，不包含 Gemma 權重。開發 Vite 模式不註冊離線快取。

### 離線版本識別與自動同步

每版以完整檔案內容與 Service Worker 產生器內容的 SHA-256 前 20 碼識別；任一發布檔案或快取邏輯改變就產生新版本，內容相同則維持原版本。畫面顯示目前版本與已下載待啟用版本。

首次開啟、網路恢復、頁面回到前景及前景每 5 分鐘，會檢查線上的 `sw.js`；未變更時不重新下載資源。發現新版後下載並驗證整版，成功後等待現有頁面關閉才切換，避免中斷文件處理或混用新舊資源。新版啟用時清理舊版快取。下載失敗顯示更新未完成並保留目前版，下次檢查自動重試；斷網期間不會同步尚未取得的版本。

`frontend/tests/offlineUpdate.browser.mjs` 以正式 build 驗證版本顯示、未變更不重抓資源、更新失敗保留舊版、定時自動重試，以及關閉後離線重開套用新版。這是 Chromium 串接驗證，並非 iPhone 實機驗收。

2026-11-08 iPhone 實機部署發現 Cloudflare 將 `/index.html` 重新導向 `/`；直接回傳快取中的 redirected Response 會被 WebKit 拒絕。Service Worker 現在將此類快取回應重建為一般 Response。App 遇到這個特定舊版錯誤時，只移除該網域的 Service Worker 註冊與 Fetch Cache，再重新載入；不移除 IndexedDB 或文件、模型。
