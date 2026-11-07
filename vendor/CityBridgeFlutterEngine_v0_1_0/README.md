# CityBridge Flutter／iPhone引擎交付包 0.1.0

**這是可交付的資料、Dart契約與移植套件，不是已完成iPhone原生推論的SDK。**

不使用HTTP伺服器、雲端LLM、BGE、E5或Embedding模型／向量檔。目標是App在同一程序內呼叫本機Gemma管線，產生candidate result.json。`handoff_status.json`為機器可讀的完成邊界。

## 已提供／尚未完成

| 已提供並測試 | 仍須移植或驗證 |
|---|---|
| Dart公開介面與生命週期、busy／timeout／cancel契約 | iOS原生Gemma執行器、完整document pipeline |
| 精確法條與FTS關鍵字Dart Repository，SQLite callback介面 | App選用的iOS SQLite套件與FTS5實機驗證 |
| 1,075筆法規、60筆租補FAQ的vector-free SQLite | App資產路徑、唯讀開啟及資料版本管理 |
| 固定輸入、result、engine response與模型階段Schemas | Dart／native端完整JSON Schema驗證器 |
| 去識別歷史輸入／輸出及fixture replay | iPhone真實推論、記憶體、延遲、取消、正確性測試 |
| 原文Guard／查詢重排／輸出投影的Python文字參考 | 原文證據、Unicode、Guard與投影的等價移植 |

`UnintegratedNativePipeline`會明確失敗，不會用假資料冒充原生模型。`FixtureReplayPipeline`只回放指定資料，每個回應都有 `execution_mode: fixture_replay`；它不執行Gemma。不得把它標成iPhone實測結果。

## 目錄

- `lib/citybridge_engine.dart`：可被Flutter path dependency引用的純Dart生命週期／結果契約。
- `lib/src/law_article_repository.dart`：原v2條號與關鍵字Repository，參數化SQLite callback。
- `native_ios/citybridge_native_contract.h`：ABI設計，只有宣告，沒有原生實作或XCFramework。
- `assets/data/`：法規與租補SQLite、來源與資料manifest，沒有vectors、chunks或模型檔。
- `schemas/`：6份自包含JSON Schemas。
- `fixtures/demo1`、`demo2`：去識別輸入、recorded_result與可供畫面回放的fixture_response。
- `data/candidates/`、`config/`：精確版本綁定的交通條文與第45條candidate白話稿。
- `data/reference_only/`：兩個臺北候選服務與兩套SOP。不是交通案件服務，不在此管線啟用。
- `reference/`：模型提示、預算與演算法文字參考，沒有HTTP transport。
- `models/model_manifest.json`：既有Gemma GGUF版本、檔名、大小及SHA256，權重不附ZIP。
- `docs/`：Mac串接、資料來源、移植責任與驗收清單。
- `validation/`：本次Windows上的Dart／資料契約驗證結果。
- `MANIFEST.json`：交付檔案指紋；根目錄ZIP旁另有SHA256。

## 接收方先做這三件事

1. 解壓縮後閱讀 `docs/INTEGRATION.md` 與 `docs/PORTING_CHECKLIST.md`。
2. 執行離線資料及契約測試，再用fixture完成畫面串接。
3. 在Mac上實作 `DocumentPipeline` 的native adapter，完成Gemma及Guard移植後才啟用真實推論模式。

從此包根目錄執行：

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r tools/requirements-validation.txt
python tools/validate_bundle.py
dart test/engine_contract_test.dart
dart test/repository_contract_test.dart
dart analyze .
dart example/replay.dart
```

只有Python資料驗證器需要jsonschema；Dart範例沒有第三方runtime依賴。套件本身未提供通用Schema validator，例子中的驗證只適用已知fixture，不能作正式模型輸出的完整驗證器。

## 呼叫契約

```dart
final engine = CityBridgeEngine(
  pipeline: yourNativeDocumentPipeline,
  validateInput: yourFullInputSchemaValidator,
  validateResult: yourFullResultSchemaValidator,
);
await engine.initialize(modelPath: localGgufPath, dataDirectory: localDataPath);
final response = await engine.analyze(inputJson, requestId: localRequestId);
```

以上native adapter與完整Schema驗證器由接收方實作；可直接執行的fixture例子在example/replay.dart。

回應使用 `engine_version: citybridge_engine_v1`，沒有api_version或HTTP status。status為completed／failed／timeout／busy／cancelled。只有completed才有result，其餘result=null。所有狀態都保留candidate、requires_verification=true；workflow只能為null。

result沿用 `citybridge_compact_result_v1`：完整input、欄位核對、引用全文／項款證據與必要前提、來源／版本、Gemma重排候選、FAQ／服務狀態與待核對事項。沒有cosine或校準信心分數。completed僅代表流程完成，不等於內容正確。

## 模型與平台邊界

既有GGUF為5,154,941,280 bytes，約5.15GB；沒有放入ZIP。可另交付原GGUF，但接收方必須核對manifest SHA256，並處理其使用／散布條款。本套件不下載模型、不以其他模型替代。

檔案大小不是推論RAM需求。沒有證明這個Gemma 4 E4B量化檔可在目標iPhone穩定運行；模型架構、tokenizer／chat template、Metal實作及程序記憶體限制都須實機驗證。不能把Windows CUDA結果當成iPhone結果。

## 已知品質限制

Windows歷史demo1能對上第45條，但欄位擷取仍有conflict，泛用第7條候選需人工核對。demo2未能解析分行法規名與「第40條0項00款06」，曾回傳速度標誌相關候選，不能當成本案處罰依據。

去識別案例的原輸入已改寫，recorded_result也同步替換input；**沒有對去識別版重新推論**。它們是UI／契約回放樣本，不是應逐字符合的模型測試gold。法規原文、官方來源與版本資料沒有做匿名替換。

目前資料包沒有交通FAQ，政府服務尚未匹配，正式workflow=null。sourceText是唯一OCR證據；summary、sixQuestions僅保留，不補成已確認事實。原始私人demo、API log、Windows執行檔與模型權重均未交付。
