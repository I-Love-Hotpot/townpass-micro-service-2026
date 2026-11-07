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
main 未有六何、OCR 人工校正與連拍介面，本次不另加 release 的舊頁面；保留 main 的操作範圍。
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

這個命令會下載約 3.66 GB 模型、重建並替換指定 Flutter checkout 的 `assets/govclear`、安裝 App。
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
前端 17 項測試、Lint、型別檢查與 production build 通過。
