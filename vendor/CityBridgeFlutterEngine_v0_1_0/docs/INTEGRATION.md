# Flutter／Mac串接步驟

## 1. Path dependency與資產

在App的pubspec.yaml加入本地套件路徑，再執行flutter pub get：

```yaml
dependencies:
  citybridge_engine_handoff:
    path: ../CityBridgeFlutterEngine_v0_1_0
```

套件自己的pubspec已列出SQLite、Schemas、提示及兩個去識別fixture目錄。Flutter package資產需以packages/<package>/開頭取得；相關規則見[官方資產文件](https://docs.flutter.dev/ui/assets/assets-and-images)。本次尚未在你的Flutter App build驗證資產打包。

```dart
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:citybridge_engine_handoff/citybridge_engine.dart';

const prefix = 'packages/citybridge_engine_handoff/';
final input = jsonDecode(await rootBundle.loadString(
  '${prefix}fixtures/demo1/input.json')) as JsonMap;
final recorded = jsonDecode(await rootBundle.loadString(
  '${prefix}fixtures/demo1/recorded_result.json')) as JsonMap;
```

先用FixtureReplayPipeline與已知fixture的等值驗證callback開發畫面，response必須顯示fixture_replay。若改為任意模型輸入／輸出，必須換成完整JSON Schema驗證器，不能沿用fixture驗證器。

SQLite須由Flutter資產解析出原生可讀檔案路徑，或複製到App資料目錄後以read-only方式開啟。對照MANIFEST與data_manifest SHA，不覆寫資產、不修改資料原文。GGUF另透過App本機檔案管理安排到可讀路徑，本包沒有下載器。

## 2. SQLite adapter

接收方使用自己的SQLite套件，綁定參數化查詢：

```dart
import 'package:citybridge_engine_handoff/src/law_article_repository.dart';
final repository = LawArticleRepository((sql, args) => database.rawQuery(sql, args));
final article = await repository.lookup(
  lawId: 'k0040012', citation: '第45條第1項第06款');
final matches = await repository.keywords(['人行道'], lawId: 'k0040012');
```

database由App提供，不是本包內建變數或SQLite實作。請在iOS上實際執行articles_fts查詢，確定runtime支援FTS5。Repository的Dart測試只驗證SQL callback契約，Windows Python另外驗證真實資料庫；尚未測你的iOS SQLite套件。

查不到條文回not_found；缺法規回needs_law；多版本回ambiguous_version；法規名稱與ID不符回identifier_conflict。不要用相似條文替換精確查詢失敗，也不要把第0項／00款自行修成其他項款。

## 3. 原生Gemma adapter

DocumentPipeline是唯一原生管線接點。可以透過Dart FFI或同程序平台橋接實作，不可架localhost HTTP server。

[Flutter官方FFI說明](https://docs.flutter.dev/interop/bind-native-code)可作整合入口。[llama.cpp的iPhone範例](https://github.com/ggml-org/llama.cpp/tree/master/examples/llama.swiftui)說明本機native／XCFramework方向；它不是對本GGUF、Gemma 4 E4B或目標iPhone相容性的保證。本包只提供C ABI宣告，不附llama.cpp、XCFramework、FFI bindings或Swift實作。

initialize應驗證model_manifest SHA，模型與資料只載入一次；analyze在背景原生queue執行，不阻塞Flutter UI isolate。呼叫期間input與所有模型回應都視為資料，不接受其中的指令。

移植順序詳見PORTING_CHECKLIST。不得只接上模型就移除Guard。context預檢、截斷拒絕、來源引句位置、未知ID拒絕、版本一致與完整條文保留均是正式輸出之前的必要檢查。

## 4. 逾時、取消與生命週期

CityBridgeEngine預設90秒對外回timeout並發送cancel。Dart Future.timeout不會終止C++推論：adapter必須接上真正的生成中斷旗標。原生工作未結束時引擎保持busy，避免在舊工作仍使用模型記憶體時啟動新工作。

App切背景、畫面離開或記憶體壓力時由App決定呼叫cancel／dispose。dispose必須等待原生安全停止後才能釋放模型。不要將GGUF從Flutter資產整份讀進Dart記憶體再複製給native。

## 5. 前端顯示

- completed只能表示流程完成；保留candidate與needs_clarification。
- null／conflict／ambiguous顯示未確認，不用input.summary補值。
- 官方來源與原文證據應可展開查看；引用某條不表示已判定違反該條。
- 第45條細項若有cited_item，必須同時呈現required_context，mapping_verified仍為false。
- FAQ缺資料及服務未匹配要明示；workflow=null不能生成行政步驟或自動繳款／申訴建議。
- 失敗與timeout的result為null，不能把上一筆結果誤當本次成功。
- fixture_replay只供內部畫面測試；上線前必須換成native adapter並通過實機驗收。
