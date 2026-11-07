# GovClear RAG／Guard 實作紀錄

日期：2026-11-08。實作於 Flutter App 與微服務 Vue 前端；不新增 Python 執行環境，也不新增後端推論服務。

## 責任與資料流

```text
Flutter 既有 OCR → WebView 原文校正
→ 微服務 G0（基本文字檢查） → Flutter Gemma 4 E4B 生成摘要＋六何 → G2
→ 同一 E4B 生成三個問題 → G3（原文唯一引句、相關性及不同用途）
→ Flutter 本機 knowledge.json 字面檢索 → G4（版本／來源＋語意充足性）
→ 同一 E4B 回答 → G5（引用白名單＋語意支持與適用限制）
→ G6 → 微服務 IndexedDB 與結果頁
```

生成與語意複核都經 `govclearNative.generate` → Flutter `SimulatorGemmaEngine.generate` → 既有 `townpass/govclear_local` MethodChannel → LiteRT-LM。每次為獨立 conversation，重用同一模型權重，串行處理。`retrieve` 由 Dart 本機查詢，不把 OCR 上傳到 Fastify。既有圖片格式／數量／大小／排序檢查保留；新增 G0 報告只紀錄這一階段收到的文字檢查，並不假裝再次驗證原圖。G1 也不能證明 OCR 和圖片一致。

摘要／六何需通過 G2 才能保存；數字差異先由程式標為疑慮，語意另檢查支持性、完整性、安全與白話程度。未通過 G2 時不覆寫既有紀錄。三題中的個別失敗不丟棄其他可用答案；未完成以程式模板呈現，`publication=partial`。不自動重試或自動修正，不發布未複核的串流候選。

每道 report 保留 stage、sourceHash、inputHash、policyVersion、executor、checks、findings、耗時與程式決策。模型只能回傳檢查候選，不能直接設定 report。問答保存完整證據 metadata、資料集雜湊、版本、查詢時間與引用 ID。手動追問同樣走輸入複核、RAG、G4/G5/G6，並將報告保存在 chat.rag。

新紀錄以可選的 `analysis.schemaVersion=2` 保存在 IndexedDB；不把這個 App 內部結構冒充上游 CityBridge engine_response schema，也沒有送到既有 v1 後端。舊紀錄沒有新 report，不能視為通過新護欄。重新解釋原文時整份分析重算、清除舊對話；保存前檢查原文是否被其他操作改動，載入時核對 sourceHash。

## 資料範圍

- 原包 SQLite 與其 SHA-256 不變，App 使用完整 metadata 的唯讀 JSON 投影。共 1,135 筆，來源原文逐筆相同。
- 本版為簡單繁中關鍵字字面檢索（最多 3 筆完整原文），不是 embedding、FTS5 或完整 CityBridge 排序演算法。沒有接上 reference_only 的服務／SOP，也沒有使用 candidate 白話法規稿。
- 不提供經驗證的精確項款定位。G4 禁止拿相似條文替代指定條文；疑義條號應回資料不足，同法條多版本不放行。
- 法規有效期間／歷史適用性未知仍保持未知。即使問答通過同模型複核，狀態也只稱 `model_reviewed`，不是法律適用性 verified。
- 租補 FAQ 的開放授權未確認，保留原 rights notice；不將其說成已獲開放授權。

## 上下文與效能限制

手機既有引擎為 4,096-token context／1,024-token output。初版 2,400 UTF-8 bytes 預檢會誤攔正常中文，已改為原生 Gemma tokenizer 計算 renderPrefaceIntoString＋renderMessageIntoString 的實際 tokens，包含系統訊息與對話模板，並保留 1,024 回答 tokens 與 64-token 邊界餘裕。超出時顯示實際 token 數，不切掉文件或法規。Dart 的 24,000 Unicode code points 上限僅限制橋接傳輸大小，不再冒充模型容量。既有原生輸出上限檢查仍保留。長文件或長條文仍可能真正超過容量；若摘要複核放不下，整份不發布。

資料解碼與 SHA 檢查在 Flutter compute isolate 執行，資料只載入一次。取消後 WebView 保持 busy 到目前工作完成；前端取消後不能再送下一次生成，晚到結果不保存。

完整三題流程最多約 15 次同模型呼叫（無修正迴圈），採 guide 第 0／12 節的獨立語意複核方向，**未採用第 13 節僅兩次呼叫的效能提案**。尚未達成或驗證 20 秒目標。同模型可能在生成與複核時犯相同錯誤，通過不代表已證明內容正確。

## 本次驗證

- Vue：49 項 Node 測試通過；涵蓋複核 JSON 截斷、超時、條件遺漏、數字變更、未知引用、來源偽裝、重複版本、無證據及部分發布。
- Vue：type-check、lint、正式 Vite build 通過。
- Flutter：檢索資料／原生 adapter／既有相關測試 10 項通過、1 項 simulator-only 跳過（on-device flag）；mock MethodChannel 不代表真機模型推論。
- Flutter：修改模組靜態分析通過，debug asset bundle 建置成功，確認打包 knowledge.json 的 SHA 與交付檔案相同。
- 原始資料：SQLite integrity、1,135 筆 metadata 等值、上游 MANIFEST 全檔雜湊已檢查。
- 既有 Python CLI 不屬於 App 執行流程、未修改；其既有測試以 `/usr/bin/python3` 通過。Homebrew Python 的 expat 動態連結有既存環境問題，未修理。

未安裝／部署新 App 或網頁。未做 iPhone／GS25 全流程實機推論、人工語意品質標註、延遲／記憶體／誤攔漏攔評測；本機 Ollama 服務未啟動。現有真機 adapter 是 iOS，沒有宣稱已新增 Android Gemma runtime。

## 本次實機安裝／發布

2026-11-08 已將新版前端發布到 Cloudflare Pages `townpass` main，部署網址為 https://fde38e9b.townpass.pages.dev；正式網域 https://townpass.fearnot.tw/sw.js 的內容已與本次 dist 比對一致。

已成功安裝到 XC’s iPhone（iOS 27.2），使用本機既有開發簽署，Bundle ID 為 `tw.fearnot.townpass.dev`、Team `BVCSFLK5AA`。原專案正式 Team 無本機憑證，故只於建置時暫時覆寫 Runner 識別碼，完成後已還原 project.pbxproj；未將識別碼全域套用到相依 framework。開發 provisioning profile 到期日為 2026-11-15（Asia/Taipei）。

Profile 原生建置成功，確認 `GOVCLEAR_ON_DEVICE=true`，App 內 knowledge.json 的 SHA 與交付資料相同。保留手機原有 Documents 與模型，核對 Gemma 模型檔大小為 3,659,530,240 bytes；未覆寫模型或清除原紀錄。本機備用模型 SHA 亦符合既有 pin。

啟動請求被 iOS 以 Locked 拒絕：安裝已完成，但手機當時鎖定。需解鎖後開啟 Town Pass → 白話人，連網下載新版介面，完成更新後關閉服務再重開。尚未驗證本次 App 的真機模型推論與效能。

## 中文上下文誤攔修正與實測

2026-11-08：將 2,400-byte 預檢改為既有 LiteRT-LM C API tokenizer 的實際計數；Swift wrapper 只增加 countTokens，使用後釋放 tokenizer result。包含系統訊息與模板，另預留 1,024 輸出 tokens＋64 邊界餘裕。

XC’s iPhone 實機回歸通過：3,607 bytes 合成中文經既有 E4B 推論，runtime 回報輸入 922 tokens、輸出 5 tokens，首 token 約 3.17 秒；另一筆超過上下文的資料在生成前被拒絕。此為上下文回歸，不是完整圖片/RAG/Guard 品質或 20 秒驗收。結果存於 native/govclear/validation/context-budget-iphone.json。

回歸後已切回 `lib/main.dart`，重新完成 Profile 簽署、覆蓋安裝並成功啟動 XC’s iPhone 上的正常 App（`tw.fearnot.townpass.dev`）。不是將測試入口留在手機上；專案正式簽署設定已還原。此修正僅在 Flutter／原生 runtime，微服務網頁無須再發布。

## 依使用者要求移除 OCR 輸入語意閘門

2026-11-08：移除 analyzeGuarded 中的 G1 模型複核。OCR 結果直接進摘要／六何生成，不再因輸入原文的可讀性、疑似缺頁或指令風險候選判定而被整份攔下。G1 不執行也不補記為通過。檔案格式／大小、空白原文、長度與模型真實 token 預算等基本檢查保留；G2～G6 的輸出／引用／發布檢查保留。文件仍明確當作不可信資料，不執行其指令。

OCR 本身是 Flutter 原生 Apple Vision，沒有這一道模型 gate；本次移除的是 OCR 完成後的輸入 gate，不代表已修復所有照片辨識問題。本次僅需部署微服務網頁，不需重裝 Flutter。

此版 50 項前端測試、lint、型別檢查及正式 build 通過；已發布至 Cloudflare Pages main（https://0034d055.townpass.pages.dev），並比對正式網域 sw.js 與本地 build 一致。手機需連網下載新版、關閉白話人後重開才會啟用；未用使用者原照片重測 OCR。

## OCR 前置模型檢查移除

2026-11-08：進一步確認 OCR 前的 `GovClearBridge.connect` 預設會先呼叫模型 `check`，即使 Apple Vision 不需要 Gemma，也可能被模型未就緒擋住。圖片 OCR 現在只連接 bridge、直接呼叫 `transcribe`，不執行 Gemma 就緒檢查或輸入語意判定。模型生成操作仍維持模型檢查。圖片格式、大小、解碼與空白結果檢查保留。

新增回歸確認圖片輸入只送 transcribe、不送 check／generate；51 項前端測試、lint、型別檢查與正式 build 通過。本項修改僅涉及網頁，不須重裝原生 App。

## Guard 限縮為模型生成輸出

依使用者最新指示，移除 G0 報告、手動追問的輸入語意檢查、G4 檢索語意複核與來源 gate 報告，以及 G6 額外發布 gate。僅保留模型生成後的摘要／六何 G2（含數字檢查）、推測問題 G3、回答 G5。檢索結果基本結構、官方 URL、資料版本與引用白名單仍屬資料／顯示安全檢查，不再另外呼叫模型做輸入或檢索語意審查。無證據仍回資料不足，不產生無依據答案。

52 項前端測試、lint、型別檢查及正式 build 通過。此為微服務網頁修改，不需重新安裝 App。輸出未通過 G2 時仍會顯示內容待核對；此次未移除使用者要求保留的模型輸出 Guard。未以使用者原文件重測。

## 數字字串誤攔修正

移除 G2-numbers 的獨立字串阻擋與 hasNewNumbers helper。該規則無法區分條列編號、格式差異與真實數值變更，會在語意複核前直接擋住候選。摘要／六何的 G2 輸出語意 Guard 仍檢查數字、日期角色、金額、義務及條件。新增回歸確認條列數字可進語意複核，而複核判定金額不符時仍阻擋；53 項測試、lint、型別檢查及正式 build 通過。未以使用者原文件驗證，也不宣稱同模型語意複核能攔下所有數值錯誤。

## 移除剩餘 AI 前置業務規則

移除網頁與 Flutter OCR 的 6,000 字限制、追問 500 字限制、所有推論操作的前置模型 check、RAG datasetVersion/hash/查詢時間與重複版本阻擋。實際生成時由 runtime 載入模型／回報錯誤；語意 Guard 僅用於生成輸出。保留解析有效證據所需的結構及安全 URL 檢查、引用白名單、來源修改後結果失效保護，以及檔案容量／格式、取消、橋接來源與真實 tokenizer 上限等執行保護。這不是移除安全邊界或取消機制。

前端 52 項測試及 lint/build 通過，Flutter 原生橋接 7 項測試通過（含 6,001 字 OCR 不再被固定字數限制擋住）。網頁已發布至 https://966a498c.townpass.pages.dev 並核對正式網域 sw.js。

此版 Flutter Profile build／簽署成功，已覆蓋安裝並啟動 XC’s iPhone 上的 `tw.fearnot.townpass.dev`；原正式簽署設定已還原，未清除 App 資料。未做使用者原文件全流程重測。

## 移除所有自訂文件輸入門檻（最新行為）

依使用者指示，移除圖片張數／大小／MIME／空檔、PDF 名稱／大小／頁數預檢、強制裁切確認、裁切 1,600 萬像素門檻、文件空白與追問非空限制。OCR 空白或 [無法辨識] 可直接往後傳遞。Flutter 移除 prompt 字數／位元組、圖片大小／magic header、policy 長度、關鍵字字數／數量及原生 tokenizer 預算拒絕。

由實際解碼器及 runtime 執行；仍保留橋接來源驗證、typed envelope、取消、知識庫完整性及安全 URL 邊界。模型實際 4,096-token 容量及輸出截斷檢查不變，生成後 G2/G3/G5 與 JSON／引用檢查保留。大檔不再先擋住，但可能增加記憶體用量、耗時，或由底層回報解碼／容量錯誤；此修改不保證任意圖檔均可 OCR。無文字時仍可能被輸出 Guard 判定資料不足。

52 項前端、11 項 Flutter 測試通過；lint、型別、正式 build 與修改模組分析通過。未用使用者原文件重測全流程。

## 最終指示：連模型輸出 Guard 也全部移除

使用者明確確認「全部移除，包含輸出 Guard」。已刪除 govclearGuard 與所有 G2/G3/G5 語意呼叫、規則報告及攔截；JSON／雜湊共用功能另放 govclearJson。新結果狀態為 generated，不再標示 reviewed、已複核或內容待核對。沒有 RAG 證據仍可讓模型只依原文生成，引用只呈現實際存在的來源；輸出 JSON 需要解析才能顯示，解碼／runtime 錯誤不會被偽裝為成功。

Flutter 亦移除繁中語言必備 gate（改用裝置支援語言）、舊摘要二次複核與六何 evidence 驗證／重試。新版網頁已部署，45 項前端測試、lint／型別／build 通過，Flutter 9 項相關測試及修改模組分析通過。舊版護欄設計稿和之前各節僅為歷史紀錄，不代表目前有執行檢查。先前真機 tokenizer 回歸同樣只適用舊版。

模型內容現在未經額外語意驗證，數字、摘要與適用性可能錯誤；未以使用者原照片重測全流程。原生解碼與模型實際容量仍可能回報錯誤，來源驗證、取消與 busy 是執行／權限保護，並未作為內容 gate。

無 AI Guard 版本已完成 iPhone Profile 建置、簽署、覆蓋安裝及成功啟動（XC’s iPhone，tw.fearnot.townpass.dev）。原正式簽署設定已還原，保留手機模型與文件資料。此為安裝驗證，未使用原照片完成辨識品質驗收。
