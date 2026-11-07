# 移植責任與驗收界線

## 可直接交給前端

固定input/result/engine_response Schemas、兩組去識別fixture、Dart結果封套與生命週期、精確條號／關鍵字Repository介面、SQLite資料、來源、模型manifest與演算法參考。

## 原生／引擎開發者必須完成

1. **Gemma runtime**：在Mac/Xcode建置iOS原生函式庫，支援指定GGUF架構、tokenizer、chat template及Metal；核對權重SHA，量測載入與峰值記憶體。不得以已能執行其他Gemma型號推論相同。
2. **模型JSON階段**：OCR抽取、短關鍵詞規劃、每4筆rerank、跨批全局重排。提示及預算見reference/prompts.json；來源限於本地SQLite，沒有向量補召回。temperature0／seed42不保證跨平台逐字一致。
3. **完整Guard**：JSON Schema、token預檢、模型截斷拒絕、原文quote存在與唯一性、候選ID白名單／去重、引用Regex、日期曆法／角色、原文中的不可信指令、上下文限制與版本雜湊。
4. **Unicode等價性**：Python參考以Unicode code point定位；Dart String預設UTF-16 code unit。必須明定輸出offset單位並測試emoji／全形字。現有Repository normalize只處理全形ASCII與引號／空白，不是完整NFKC實作。
5. **候選範圍**：保留短原句／Gemma關鍵詞、FTS法條與FAQ原文字面召回、來源／主題過濾、最多8筆預選及完整audit。避免只移植Gemma排序、漏掉召回與來源檢查。
6. **精確法律版本**：條號、法名、版本不得猜測，項款未核對時回完整條文及共同前提。9999-12-31不能當成真正逐條生效日；刪除／廢止與歷史適用性要分開處理。
7. **輸出投影／白話稿**：按result Schema輸出；第45條白話稿若使用，需移植精確版本／全文SHA／上下文綁定，不能直接把candidate稿當已驗證法律解釋。完整演算法不是Dart wrapper已實作的功能。
8. **SQLite／資產**：唯讀、參數化、FTS5、Manifest核對，iOS實際檔案路徑與資料更新版本。reference_only的臺北服務不是交通案件服務；本包未實作資格與SOP匹配。
9. **停止與資源**：模型單次載入、背景執行、busy拒絕、真實native cancel／dispose確認、低記憶體與背景生命週期。只有Future.timeout不算中止推論。
10. **本機資料處理**：不新增HTTP或雲端推論，不傳送私人OCR。稽核紀錄由App決定本機保存方式；不要將未去識別輸入放入發佈assets。

## iPhone驗收（尚未執行）

- 用真實裝置驗證GGUF能載入、完成推論，記錄iPhone型號、iOS/Xcode/runtime版本、權重SHA、可用context及Metal設定。
- 量測首次／後續查詢、模型載入、token預檢、峰值記憶體、低記憶體回收、背景／取消、發熱與電量。
- 比較一批人工核對文件的擷取、候選Recall、排序MRR／nDCG、範圍外拒答及JSON有效率。保留失敗案例，不以fixture replay當實機推論。
- 測試demo1的相同法律引用與原文證據；demo2應保留零項／零款及分行名稱疑義，不能猜成第40條確定適用。
- 測試未知ID、偽造引文、截斷、來源版本改動、Schema不合、逾時後工作仍運行、busy及無模型狀態；不得回傳半成品或升成verified。

目前不能宣稱：iPhone 15 Pro Max已測試、固定延遲、指定RAM可運行、Gemma原生移植完成、所有條文現行有效，或整體檢索／法律正確率已達標。
