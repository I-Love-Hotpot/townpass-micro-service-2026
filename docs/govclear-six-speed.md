# 六何整理耗時修正（2026-11-08）

本次修改位於實際使用的 Flutter host `TownPass-publish`，不是微服務前端：
`lib/service/six_question_evidence.dart`，相關測試為
`test/six_question_evidence_test.dart` 與 `integration_test/plain_language_six_performance_test.dart`。

使用者提供的完整 713 字 OCR 原文在 iPhone 14 Pro 重現：模型將引用編號
回成 `[編號, 原句]`，遭驗證器拒絕後重跑 JSON 約束推論，實測共 78.878 秒。
提示詞改用編號到原句的物件，明確要求只回整數編號；解析器相容成對引用，
但必須驗證編號範圍與原句完全一致，再從原始文件取值。缺欄、空白、錯誤型別、
重複欄位、越界、原句遭改寫與截斷內容仍會拒絕。另明確要求保留各事件的截止時刻。

修正後同一份完整原文實測 17.744 秒，輸入 900、輸出 274 token，使用 GPU MTP，
六欄格式、截止時間、樓層限制及上傳方式驗證通過。14 項單元測試、相關檔案
Flutter analyze 與 iOS profile 建置通過。

真機測例可從 App Documents 的 `baihua-six-repro.txt` 讀取該賽事 OCR，
測完自動刪除。原文與帳密不加入版本庫，報告只保存耗時及 token 統計。
這是單一文件與裝置的結果，不是所有文件的時間或完整性保證。
