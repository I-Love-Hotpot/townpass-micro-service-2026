# GovClear 微服務介面與 Flutter 容器

GovClear 的介面、圖片預覽、文字校正、摘要流程及結果卡片均位於本微服務的 Vue 前端，不再以 Flutter 原生頁實作。

| 模組 | 位置 | 責任 |
|---|---|---|
| Vue 介面 | `frontend/src/views/GovClearView.vue` | 文字／圖片兩種入口、人工校正、摘要、停止與原文回查 |
| 原生橋接客戶端 | `frontend/src/services/govclearBridge.ts` | request ID、回覆配對、逾時、取消與清理 |
| 圖示 | `frontend/src/components/GovClearIcon.vue` | 本機 SVG 圖示，不載入外部資源 |
| 路由 | `/govclear` | 微服務內的獨立頁面 |
| 合成樣本 | `frontend/src/assets/govclear/` | 文字及 PNG，僅供測試 |
| Flutter 容器 | `../TownPass/lib/page/govclear/govclear_webview.dart` | 載入微服務、檢查來源、接收原生推論請求 |
| Flutter 模型適配器 | `../TownPass/lib/service/govclear_simulator_engine.dart` | 僅 Debug iOS 模擬器可呼叫 Mac Ollama |

## 一鍵測試（建議）

在 VS Code 開啟 `/Users/xc/townpass`，選「TownPass + GovClear 微服務（一鍵測試）」按 F5。預設的「TownPass」Debug 設定也已接上一樣的準備程序。

啟動前會執行 `local-inference/prepare_simulator.py`，自動：

1. 檢查／啟動 Mac Ollama，確認本機 E4B 文字與圖片權重；首次缺少模型才下載。
2. 檢查／啟動固定 `127.0.0.1:5173` 的 Vue 微服務，前端依賴缺少時安裝。
3. 準備 Flutter 依賴與產生的 TownPass 資源程式（首次缺少時）。
4. 開啟可用的 iPhone 模擬器與 Device Hub，將合成通知圖片加入相簿（同一版本只加入一次）。
5. 啟動完整 TownPass 的「服務」頁；點第一個「GovClear 看懂文件」即可進入微服務。

測試模式僅在 Debug 且 `GOVCLEAR_TEST_MODE=true` 時生效，從服務頁開始並略過與本功能無關的通知權限彈窗；不修改既存首頁偏好。Profile／Release 不啟用。

也可以在此專案根目錄用單一命令準備並啟動：

```sh
python3 local-inference/prepare_simulator.py --run
```

環境準備錯誤會顯示原因。自動啟動的服務日誌位於 `local-inference/.runtime/logs/`，模型與日誌均已忽略 Git；已在運作的服務會先檢查再沿用。腳本需要已安裝的 Python 3.9+、Ollama、Node、pnpm、Flutter 與 Xcode。

頁面可用「載入範例」快速測試，也可以在圖片摘要選擇已加入模擬器相簿的合成通知。辨識文字可人工校正後再摘要；上方返回鍵可回到 TownPass。原有 Test 服務的設定保留。

微服務頁面是 `http://127.0.0.1:5173/govclear`。瀏覽器可預覽介面；本機推論需要 Flutter 容器。既有 Docker 的 `localhost:3000` 入口不會自動取得開發橋接權限。

## 個別啟動（需要時）

```sh
# 終端機一：本機模型
cd local-inference
sh serve.sh

# 終端機二：Vue 介面
cd frontend
pnpm dev:govclear

# 終端機三：完整 TownPass
cd ../TownPass
flutter run --debug -t lib/main.dart -d <iOS模擬器ID> --dart-define=GOVCLEAR_SIMULATOR=true --dart-define=GOVCLEAR_TEST_MODE=true
```

## 多張照片

圖片摘要可一次多選 PNG / JPEG，最多 5 張、單張 20 MB、合計 50 MB。也可以分次「繼續加入照片」。每張顯示縮圖與頁序，可往前／往後移或移除；正在推論時會鎖定圖片清單。

辨識按目前順序逐張執行，顯示「第 n / N 張」進度。每張都有獨立的校正文字欄位；全部文字就緒後，依目前頁序標記合併產生一份摘要。排序、移除或校正會清除舊摘要，避免混用不同版本。

辨識失敗會保留其他已完成頁面；再次辨識僅處理未完成圖片，不覆蓋已核對的文字。停止後同樣保留已完成結果。整份文字仍受 6,000 字上限限制（含頁序標記），超過時需減少圖片或分批摘要，不靜默截斷原文。

「載入範例」會加入兩張不同內容的合成通知，開發準備腳本也會將兩張放入模擬器相簿。私人圖片保留為頁面記憶體中的 Blob／預覽 URL，只在逐張辨識時經原生橋接傳給本機模型。

## 資料路徑

```text
Vue 微服務（文字或圖片）
  → govclearNative.postMessage
  → Flutter WebView 主框架／來源／路徑檢查
  → Mac 本機 Gemma 4 E4B
  → 回覆 Vue
  → 顯示辨識文字並人工校正
  → 再次橋接產生摘要
```

文件不經 Fastify、MariaDB 或 Vite proxy，沒有新增 `/infer`、`/chat`、`/document-upload` API。瀏覽器端不持久化文件；選圖資料留在頁面記憶體，只有內建公開範例會從 Vite 讀取。這是模擬器與同機模型的開發路徑，iPhone 正式版仍需 Native 端上 runtime 與 bundled 安全工作區，不能直接用遠端 H5 取得私人模型能力。

橋接名稱為 `govclearNative`，使用 `{name:'govclear',data:{id,action,payload}}`，action 僅接受 `check`、`transcribe`、`summarize`、`cancel`。回覆包含同一 id、ok、result 或 error；傳輸時使用 `base64:` 加 UTF-8 JSON 編碼，以避開舊 iOS 套件對換行／反斜線的跳脫問題。舊版 iOS WebView 套件對非標準 port 的注入規則有型別比較問題；目前採 Debug 注入相容處理，原生 handler 仍在解析內容前拒絕非主框架、非 `http://127.0.0.1:5173`、非 `/govclear` 的呼叫，並拒絕外部頁面導覽。實體裝置與 Profile／Release 不允許使用 Mac 模型適配器。

## 檢查

```sh
# 此微服務 frontend 目錄
pnpm build

# TownPass 目錄（先開啟前端與 Ollama）
flutter test test/govclear_test.dart
flutter test integration_test/govclear_test.dart -d <iOS模擬器ID> --dart-define=GOVCLEAR_SIMULATOR=true --dart-define=GOVCLEAR_TEST_MODE=true
```

## 本次驗證（2026-11-07）

Vue 正式建置、TypeScript 檢查、2 項 JavaScript 橋接回歸測試、2 項 Flutter 邊界測試通過。iPhone 18 Pro / iOS 27.2 模擬器的 Vue → Flutter Bridge → E4B 真實推論整合測試通過（約 42 秒）。文字摘要保留金額與年齡例外；圖片轉錄保留期限；將辨識文字的 200 元修改成 300 元後，摘要使用 300 元。此驗證是合成樣本的操作與資料流測試，不是全面公文準確率或實體手機端上推論驗證。

完整 App 測試也可直接在微服務根目錄執行 `python3 local-inference/prepare_simulator.py --test`，自動準備服務後跑完整入口與返回測試。

完整 TownPass 入口整合驗證已於 2026-11-07 通過（約 50 秒），包含服務列表進入、兩條真實推論流程、修正後文字摘要與返回服務頁。另已在前端及 Ollama 均關閉的狀態驗證一鍵自動啟動，並確認合成圖片已加入相簿、重複準備不會重複匯入。

多張照片功能已完成 6 項 JavaScript 回歸測試及完整 TownPass 真實模型整合測試（約 61 秒），涵蓋多檔選取事件、移除後重新加入、調整順序、逐張辨識、人工改為 300 元，以及合併摘要同時保留金額和另一張的水壺事項。頁序依據隨排序更新。此測試未自動操作系統相簿選擇器；相簿已匯入兩張合成照片，可手動測試原生多選視窗。

## 新增自己的測試圖片

將 PNG / JPG / JPEG 放進 `local-inference/examples/`，按 F5 或執行 `python3 local-inference/prepare_simulator.py --sync-examples`；也可執行 VS Code 工作「GovClear: 匯入自訂測試圖片」。程式會依檔名與內容版本避免重複匯入，支援中文、空格、大小寫副檔名。匯入後從 App 相簿選擇器選圖；「載入範例」仍只載入兩張內建合成通知。自訂資料不會因此加入前端發布資產。

## 摘要力度與白話呈現

摘要預設改用「先看重點、別漏掉」兩層，移除背景套話、重複資訊與空白確認卡；不再要求在摘要內重複引用原文短句。原文仍可展開回查。超過 300 字的文件會額外以原文核對候選摘要，補回必要條件。Python 與 App 共用微服務資產中的兩份規則，詳見 [摘要規則與實測](govclear-summary.md)。

## 檢索上下文更新（2026-11-08）

retrieve的payload維持terms JSON字串，新增選填source字串。Flutter仍回傳最多三筆完整evidence，在各筆另附context_text及context_is_excerpt，供模型閱讀與文件相關的完整段落。text及原有版本／雜湊metadata保持完整；引用顯示使用text。沒有新欄位的舊host仍可運作，但會以全文推論，未必有相同速度改善。所有處理仍在裝置端。
