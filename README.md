# GovClear｜看懂文件

**把文件整理成白話重點，讓使用者更容易找到對象、期限、辦理方式與注意事項。**

GovClear 整合於城市通（TownPass），支援輸入文字、選擇圖片與累積多張拍照。iPhone 使用 Apple Vision 辨識文字，再透過手機上的 Gemma 4 E4B 產生白話摘要與六何整理；可另外把原文與結果以 JSON 儲存到微服務。

開發團隊：**拖把吃火鍋不揪**

> 目前為開發驗證版本。RAG 問答與逐步 AI Guard 尚未實作；單張圖片完整流程 20 秒內是目標，尚未驗證達成。

## 功能與狀態

| 功能 | 狀態 |
| --- | --- |
| 純文字白話摘要 | 已實作 |
| iPhone 圖片 OCR 與地端摘要 | 已實作 |
| 相簿多選、累積拍照後批次處理 | 已實作，最多 5 張 |
| 自動六何整理：何人、何事、何時、何地、為何、如何 | 已實作 |
| 原文、摘要、六何 JSON 預覽／複製與後端儲存 | 已實作，需設定後端網址 |
| 安裝時沿用手機已驗證且未變更的模型 | 已實作 |
| 推測 3 個問題、檢索法規並依據資料回答 | 規劃中 |
| 各步驟的輸入／輸出語意護欄 | 規劃中；目前格式檢查不等於語意驗證 |

## 架構

```text
城市通 Flutter App
  └─ WebView：內嵌 Vue GovClear 介面
       ├─ 原生橋接 → Apple Vision → 辨識文字
       ├─ 原生橋接 → LiteRT-LM / Gemma E4B → 摘要、六何
       └─ 可選 JSON 上傳 → Fastify 微服務 → MariaDB
```

- **手機推論**：OCR、摘要與六何在 iPhone 執行；安裝完成後不需要 Mac Ollama 或網際網路來推論。
- **結果儲存**：另需網路與運行中的後端。設定上傳後，原文、摘要及六何會送到指定後端，不包含圖片檔。
- **電腦／模擬器路徑**：使用 Mac 上的 Ollama，與手機原生推論分開。
- **單模型設計**：摘要與六何共用 Gemma E4B；Apple Vision 負責 OCR。

手機 WebView 的 `127.0.0.1:5173` 是手機自己的靜態介面服務，不是電腦後端。

## 專案目錄

```text
townpass-micro-service-2026/
├─ frontend/                 Vue 3 + TypeScript 介面、提示詞與測試
├─ backend/                  Fastify API、資料表 migration 與查詢工具
├─ local-inference/          iPhone／模擬器準備腳本及電腦推論原型
│  ├─ examples/              合成通知範例
│  ├─ prepare_iphone.py      打包、安裝 iPhone 離線版
│  └─ prepare_simulator.py   準備 Mac／模擬器測試環境
├─ docs/                     操作、驗證、設計與授權文件
├─ docker-compose.yaml       本機開發服務
└─ LICENSE                  AGPL v3 正式全文
```

Flutter 專案在另一個 repository：[TownPass](https://github.com/I-Love-Hotpot/TownPass)。準備腳本預期兩個目錄並列：

```text
工作目錄/
├─ TownPass/
└─ townpass-micro-service-2026/
```

## 快速開始：iPhone 離線版

### 環境

- macOS、Xcode、Flutter 及可用的 iOS 開發簽署設定。
- Python 3、Node.js 22 與 pnpm；先在 `frontend` 安裝前端依賴。
- iPhone 開啟開發者模式、信任開發電腦，連線並解鎖。
- 初次準備需要網路下載依賴與約 3.66 GB 的模型，電腦與手機需留有足夠空間。

已在 iPhone 15 Pro Max 與 iPhone 13 Pro Max 安裝驗證；這不代表所有 iPhone 均已通過效能或記憶體測試。

### 首次安裝或更新

在微服務專案根目錄執行：

```bash
pnpm --dir frontend install --frozen-lockfile
python3 local-inference/prepare_iphone.py
```

只有一支實體手機時自動選取；多支手機時指定 UDID：

```bash
flutter devices
python3 local-inference/prepare_iphone.py --device YOUR_IPHONE_UDID
```

將 `YOUR_IPHONE_UDID` 換成實際裝置 ID。腳本會準備模型、打包 Vue、同步 Flutter assets、編譯 Profile 版、安裝並啟動 App。入口為「服務 → GovClear 看懂文件」。

更新時不用先刪除 App。手機模型相同則跳過複製；舊安裝缺少驗證記錄時，首次會將模型讀回電腦核對雜湊，額外需要約 3.66 GB 暫存空間。必要時可加 `--force-model-copy` 強制傳輸。

### 只用 Flutter 更新／啟動

已準備好 Vue assets 與手機模型時，在 **TownPass 目錄**執行：

```bash
flutter run --profile \
  -d YOUR_IPHONE_UDID \
  -t lib/main.dart \
  --dart-define=GOVCLEAR_ON_DEVICE=true
```

這個指令不會重新打包 Vue，也不會安裝缺少的模型。修改微服務前端後，請重新執行 `prepare_iphone.py`。Profile 模式不支援 Hot Reload；App 重啟後載入模型到記憶體，也不等於重新下載模型。

詳細設定見 [iPhone 離線版說明](docs/govclear-iphone-offline.md)。

## 啟動後端與 JSON 儲存

只做手機離線辨識與摘要時，可以不啟動後端。需要儲存結果時，在微服務根目錄依序操作。

### 1. 設定環境與啟動服務

若尚無 `.env`，複製範例後設定本機資料庫帳密；已有 `.env` 時不要覆蓋：

```bash
cp -n .env.example .env
# 編輯 .env，設定 MYSQL_DATABASE、MYSQL_USER、MYSQL_PASSWORD、MYSQL_ROOT_PASSWORD

docker compose up -d --build
docker compose exec -T dev-backend npm run results:init
```

| 開發服務 | 網址／連接埠 |
| --- | --- |
| Vue 介面 | http://localhost:3000/govclear |
| API | http://localhost:3001 |
| API 健康檢查 | http://localhost:3001/health |
| Swagger 頁面 | http://localhost:3001/api-docs |
| Adminer | http://localhost:3002 |

一般瀏覽器可以查看介面，但無法使用 Flutter 原生地端模型橋接。JSON 接收規格以[結果儲存文件](docs/govclear-result-export.md)與後端路由為準。

### 2. 設定手機可以連到的後端網址

在 `frontend/.env.local` 設定以下值，把範例 IP 換成電腦的實際區網 IP：

```dotenv
VITE_GOVCLEAR_RESULTS_API_URL=http://192.168.1.100:3001/api/govclear/results
```

接著重新執行 `prepare_iphone.py`，讓新網址進入手機內嵌的介面。手機與電腦需在可互通的區網，並允許 App 區域網路存取；後端 CORS 設定需允許 `http://127.0.0.1:5173`。

此網址是建置時設定，單改 `.env.local` 不會更新已安裝的 App。未設定時不自動上傳。

目前 JSON 接收端點供區網測試，尚未接入帳號驗證；正式公開部署需補齊認證、存取控管與 HTTPS。原文及摘要可能含有個人資訊。

### 3. 查看已儲存結果

前端摘要下方的「結果 JSON」可展開或複製內容。請確認狀態顯示「已儲存到後端」，僅看到 JSON 不代表儲存成功。

```bash
# 查詢最近 10 筆結果編號
docker compose exec -T dev-backend npm run results:list

# 將 RESULT_ID 換成畫面上的結果編號
docker compose exec -T dev-backend npm run results:show -- RESULT_ID
```

`POST /api/govclear/results` 接收以下欄位：

| 欄位 | 內容 |
| --- | --- |
| `schemaVersion` | 目前為 `1` |
| `resultId` | 結果 UUID，重試沿用同一編號 |
| `generatedAt` | 產生時間 |
| `inputMode` | `text` 或 `image` |
| `sourceText` | 本次摘要使用的原文；多圖為修正後依頁序合併文字 |
| `summary` | 白話摘要 |
| `sixQuestions` | `who`、`what`、`when`、`where`、`why`、`how`；未提及資訊為 `null` |

六何成功後才自動儲存。相同 ID 與內容重送不新增重複資料；相同 ID 不同內容回應 `409`。舊版未傳 `sourceText` 的資料仍可接受，不會自動回補原文。待送內容只保留於目前頁面，離開前請確認儲存成功或複製 JSON。

## 電腦與模擬器測試

在具備 Flutter／Xcode 模擬器環境的 Mac，安裝 Ollama 後，於微服務根目錄執行：

```bash
python3 local-inference/prepare_simulator.py --run
```

此路徑使用 Mac 模型，不是手機 E4B runtime。操作與橋接說明見 [WebView 整合文件](docs/govclear-webview.md)。電腦純 Python 文字／圖片推論原型見 [local-inference README](local-inference/README.md)；該原型的限制與手機版不同。

合成測試通知位於 `local-inference/examples/`；請不要將私人罰單、個人文件、模型權重或 `.env` 提交到 Git。

## 開發驗證

在微服務根目錄執行：

```bash
# 前端單元測試與建置（需先安裝 frontend 依賴）
node --test frontend/tests/*.test.mjs
pnpm --dir frontend build

# 後端 API 測試（需啟動 Docker 開發環境）
docker compose exec -T dev-backend npm test

# Python 工具測試
python3 -m unittest discover -s local-inference/tests -v
```

測試涵蓋解析、資料流、錯誤處理及模型重用等行為，不代表實際模型準確率。實機應另外核對日期、金額、對象、必要材料、否定、條件與例外。

## 限制與下一階段

- 最多 5 張圖片，單張 20 MB、合計 50 MB；摘要文字最多 6,000 字元。
- 圖片模糊、反光、小字與表格可能造成 OCR 錯誤；摘要與六何仍需對照原文。
- 尚未實作 RAG 三題問答及逐步語意 Guard；目前 JSON 格式驗證不能保證事實正確。
- 規劃以同一顆 Gemma E4B 處理生成與語意檢查。為達單張完整流程 20 秒目標，提出兩次模型呼叫方案，但尚未實測達標，也不是所有文件／裝置的速度保證。

完整流程、輸出結構、錯誤分級與效能取捨見 [AI Guard 與 RAG 設計稿](docs/govclear-output-guard-design.md)。

## 文件索引

- [iPhone 離線版安裝與實測](docs/govclear-iphone-offline.md)
- [JSON 格式、儲存與查詢](docs/govclear-result-export.md)
- [Vue／Flutter WebView 整合](docs/govclear-webview.md)
- [白話摘要規則](docs/govclear-summary.md)
- [AI Guard 與 RAG 設計](docs/govclear-output-guard-design.md)
- [授權範圍與發布說明](docs/licensing.md)

## 授權

Copyright (C) 2026 拖把吃火鍋不揪

本專案自行開發且有權授權的程式碼採用 **GNU Affero General Public License v3.0 only**（`AGPL-3.0-only`），正式條文見 [LICENSE](LICENSE)。允許商用，使用者須遵守適用的原始碼提供、聲明保留等義務；不附加「商用另行同意」限制。

既有上游與其他貢獻者署名保留。配套 TownPass Flutter 保留上游 GPL v3，並以 LICENSE-GOVCLEAR 說明團隊有權授權的 GovClear 原創貢獻採 AGPL-3.0-only。第三方套件、模型、資料與素材的授權不因本聲明而被替換。團隊署名僅適用於本團隊自行開發且有權授權的內容。競賽要求與尚待補齊的發布事項見[授權說明](docs/licensing.md)。
