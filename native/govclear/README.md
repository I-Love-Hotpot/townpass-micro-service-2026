# Flutter 端上 RAG 與 Gemma 4 整合

執行流程沒有 Python。Gemma 留在 Flutter App 既有的 iOS LiteRT-LM 原生引擎，微服務網頁只透過 WebView bridge 發送任務、檢查結果並保存本機紀錄。正式手機模式不呼叫 Ollama、localhost 或後端推論 API。

本次已修改 `/Users/fearnot/Desktop/TownPass-merge` 的 Flutter 原始碼與資產。該目錄原有 `.git` 指向不存在的 worktree，因此本目錄另外保存可重套的 `flutter-integration.patch`。不修復或覆寫其 Git metadata。

## 交付內容

- `assets/knowledge.json`：原包 1,075 筆法規＋60 筆租補 FAQ 的完整 metadata 投影，原文、來源、版本、有效期間、provenance 均保留；不含模型權重或向量。
- `assets/knowledge.sha256`：固定資料 SHA-256。Flutter 載入時比對程式內固定值，微服務也核對傳回的資料版本與雜湊。
- `flutter-integration.patch`：新增 Dart 本機字面檢索、背景 isolate 資料解碼、WebView 的 `generate`／`retrieve` 動作、Gemma 上下文預檢、取消後 busy 保護及測試。
- 原始來源包完整保存在 repository 的 `vendor/CityBridgeFlutterEngine_v0_1_0`；其中 Python 是上游演算法參考文件，沒有進入 App 資產或執行流程。

現有 `crypto 3.0.8` 從間接依賴改列直接依賴，沒有新增生成模型或 embedding runtime。手機模型沿用原 App 已安裝的 `gemma-4-E4B-it.litertlm`，不使用上游 GGUF manifest 取代現有模型。

## 套用到另一份相同基底的 Flutter checkout

已修改的 TownPass-merge **不要重套**。其他 checkout 先確認 patch 可套用，再複製資產：

```sh
cd /absolute/path/to/TownPass
patch --dry-run -p1 < /absolute/path/to/townpass-micro-service-2026/native/govclear/flutter-integration.patch
patch -p1 < /absolute/path/to/townpass-micro-service-2026/native/govclear/flutter-integration.patch
mkdir -p assets/govclear_rag
cp /absolute/path/to/townpass-micro-service-2026/native/govclear/assets/* assets/govclear_rag/
flutter pub get --offline
flutter test --no-pub --dart-define=GOVCLEAR_ON_DEVICE=true test/govclear_knowledge_test.dart test/govclear_native_engine_test.dart
```

正式手機建置需沿用 `--dart-define=GOVCLEAR_ON_DEVICE=true`；未啟用時不會偷偷改用遠端推論。既有 Mac Ollama adapter 僅供明確啟用的 iOS Debug 模擬器使用，這次沒有加入 Python server。

資料更新須重新核對原始包的 manifest、逐筆 metadata、資料筆數、來源與授權，並同步更新 Dart 與 TypeScript 的固定 checksum／datasetVersion；不可只替換 JSON。完整版本的資料保留於本機，送入模型時只帶必要欄位，但條文正文不截斷。

詳見 `docs/govclear-rag-guard.md` 的流程、測試與限制。

## 分段顯示與測速更新

最新微服務已從 5 次生成合併為 2 次，先顯示摘要／六何，再依內容需要補最多三題問答，不湊滿。Dart 檢索加入中文雙字詞匹配；沒有重新加入輸入限制或 AI Guard。測速 policies 及原生結果在 validation/speed-prompts.json、validation/speed-iphone.json。原生短通知基準約 12.8～13.7 秒，並非所有圖片的端到端保證；細節見 docs/govclear-rag-guard.md 最新章節。

## 情境合理性真機測試

Flutter `integration_test/govclear_logic_test.dart` 以手機現有 Gemma 測試14歲駕駛、14歲乘客搭成人駕駛車輛，以及11月14日。執行前將 validation/logic-policy.json 複製到 App Documents/govclear-logic-policy.json，測試結果寫入 Documents/govclear-logic-test.json。此測試不使用OCR圖片，僅驗證辨識後的情境判讀。正常App仍由 lib/main.dart 啟動。

## 多筆參考資料加速

Dart retrieve可接收source，為每筆候選產生context_text/context_is_excerpt，模型使用相關完整段落；原text與引用全文保留。保留首段、FAQ基本說明、款內子目及可辨識的同條款次連結，並非跨條文法律適用性解析。網頁與Flutter需同步更新才會取得此加速。integration_test/govclear_speed_test.dart同時確認三筆候選完整保留、兩輪原生照片流程不超過20秒，並檢查縮短後提示詞的年齡／角色／日期案例。
