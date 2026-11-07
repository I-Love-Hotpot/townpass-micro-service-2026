# iPhone 端上 E4B（開發驗證）

發布分支：`release/govclear-iphone-offline`。本機開發分支 `feat/govclear-iphone-offline`、自動摘要版與人工確認版保留。
Flutter 與微服務請搭配相同發布分支；私人罰單與測試截圖不包含在發布歷史中。

本版的介面架構是 Vue 打包資源 → Flutter WebView → Swift MethodChannel。
圖片文字辨識使用手機 Apple Vision；白話摘要使用 LiteRT-LM → 手機內 E4B，兩者皆離線執行。
手機只在自身 `127.0.0.1:5173` 提供 App 內的靜態資源；該位址不是 Mac，沒有推論 HTTP API。
模型透過 USB 安裝到 App 的 Documents，不經城市通伺服器，也不需要 Mac Ollama。

依賴：Google LiteRT-LM `0.19.1`，官方 Swift 原始封裝保留在 TownPass 的
`ios/Packages/LiteRTLM`（含授權），官方 iOS 二進位由 SwiftPM 依 SHA-256 驗證；
不需要下載整個上游 Git 歷史。模型 `litert-community/gemma-4-E4B-it-litert-lm`，
revision `71064b01bd5e2bfd9a5f9dd52df86ae4800138c1`，CPU INT4 檔案 `gemma-4-E4B-it.litertlm`。
大小 3,659,530,240 bytes，SHA-256 `0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0`。
下載與雜湊核對只發生在 Mac 準備階段，權重不加入 Git。
來源：[官方 Swift 整合指南](https://github.com/google-ai-edge/LiteRT-LM/tree/v0.19.1/samples/ios_and_mac)、
[模型檔案](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/tree/71064b01bd5e2bfd9a5f9dd52df86ae4800138c1)。

## 安裝

iPhone 開發者模式開啟、USB 連線並解鎖；Xcode Runner 的簽署 Team 必須能安裝到該手機。
在微服務根目錄執行：

```sh
python3 local-inference/prepare_iphone.py
```

只有一支實體 iPhone 時自動選取；多支則帶 `--device <UDID>`。
腳本下載並核對模型、建置 Vue、複製至 Flutter assets、以 Profile 模式建置、安裝 App、
透過 USB 傳輸模型，最後開啟 App。首次 SDK 下載與模型傳輸可能需要數分鐘。
修改 Vue 後必須重跑打包；真機不使用 Vite 熱更新。
`--prepare-only` 只準備模型及介面。手動 build 必須帶 `--dart-define=GOVCLEAR_ON_DEVICE=true`。

## 驗證範圍

真機測試：`integration_test/govclear_offline_test.dart`，使用合成通知測試 E4B 圖片轉錄與摘要。
模型首次載入時間納入首次辨識耗時，不能拿 Mac 的 3 秒推論數據當手機效能。
初測使用 CPU，4,096-token context、最多 1,024 個輸出 tokens、每張圖片 140 個影像 tokens、關閉額外思考；
目前手機已改用下節的 GPU + MTP 純文字摘要，不初始化 E4B 影像編碼器；
達到長度上限就拒絕把截斷輸出當成功。模型檔存在檢查不代表載入和推論成功。
離開 GovClear 後釋放模型；取消後不接受舊結果，也不會自動轉送 Mac 或雲端。

真機原生模型初測（iPhone 15 Pro Max）：合成 notice.png 辨識 17.236 秒（含引擎載入），
簡短測試提示詞摘要 14.009 秒。日期、費用與免收費條件驗證通過；
此測試摘要提示詞不是正式 UI 的完整白話規則，不能當成正式介面的速度或品質保證。
預設影像預算曾出現張量配置錯誤，140-token 設定已通過此合成樣本。
目前圖片改走 Apple Vision OCR，不再使用 E4B 分區重試；E4B 保留做文字摘要。

目前簽章使用 Increased Memory Limit（已驗證生效），不使用個人帳號不支援的
Extended Virtual Addressing。進入功能時先載入模型與影像編碼器，再建立 WebView；
載入失敗會顯示錯誤與重試。長文件若超出手機 token 配額須分批，不會截斷原文硬產生結果。

完整離線介面測試已在 iPhone 15 Pro Max / iOS 27.2 通過：短文白話摘要、長文第二輪核對、
範例與實際 File input 多選兩張圖片後自動摘要、排序、200→300 元人工修正後重新摘要、
按返回釋放模型。使用 `integration_test/govclear_offline_ui_test.dart` 的手機端報告驗證，
不依賴 Flutter VM Service 連線；報告檔為 App Documents/govclear-offline-ui-test.json。
兩份報告的本機副本在 `.runtime/iphone/`，不納入版本控制。
已建置並安裝正常 `lib/main.dart` 的 Profile 版本，沒有把測試入口留給使用者。

## Apple Vision OCR

手機 `transcribe` 使用 `VNRecognizeTextRequest`，準確模式，執行前確認支援繁體中文，
辨識語言為繁體中文及英文。關閉語言修正，避免字典自動修改編號與金額。
影像解碼時校正 EXIF 方向，最長邊限制 3200；本次 1108×1477 罰單保留原有解析度。
辨識在背景序列佇列進行，支援取消；不需載入 E4B，不上傳圖片或文字。
依文字框位置從上到下、同列從左到右整理，欄位之間保留 tab。
這是幾何排序，不是表格語意還原；複雜多欄、直書或模糊文件仍須人工核對。
空結果顯示錯誤；沿用原有 6000 字上限，不截斷、不自動退回較慢的 E4B 圖片辨識。

iPhone 15 Pro Max 原罰單單次 OCR 實測：**1.175 秒、1141 字**，
檢查讀到金額 `600` 與違規文字 `人行道`。此數字不含模型載入、摘要，
兩個關鍵字通過不代表整份文件每字正確。
測試入口 `integration_test/govclear_vision_test.dart`，刻意不載入 E4B。
報告為 App Documents/govclear-vision-test.json。

先前 E4B 整張圖片縮為 480×624；嘗試重疊分區及最多兩層細分後，
超過三分鐘仍未完成，已停止該輪測試，未宣稱罰單測試通過。
目前預設 OCR 不再呼叫該分區流程。

完整介面回歸入口：TownPass `integration_test/govclear_document_repro_test.dart`。
測試圖片放在手機 App Documents/govclear-repro.jpg，不打包、不加入 Git；
結果寫入 Documents/govclear-document-repro.json，只記錄狀態、耗時、字數與關鍵字檢查，
不記錄罰單個資。測試完成後須重新安裝正常 main.dart。

本次完整介面罰單回歸通過：選圖到摘要顯示 **114.942 秒**，包含 OCR、
原有 E4B 摘要與核對流程，不包含進入頁面前的模型預載。
完整流程仍慢，不能將 1.175 秒 OCR 宣稱為整體反應時間。
來源文字區含 1149 個字元（介面會加上來源標籤），金額與違規關鍵字檢查通過；
這是流程與關鍵字驗證，不是全部 OCR 文字或摘要內容的逐字正確性驗證。

## 手機單輪摘要加速

手機改用 `frontend/src/assets/govclear/summary-mobile-policy.txt`（573 字），
原長版規則為 2106 字。手機只做一輪摘要，保留輸出前自查指示，
取消自動第二輪重寫；Mac 模擬器原有兩輪流程保留。
模型仍為 E4B，OCR 仍為 Apple Vision，context 與輸出上限未變更，原文不截斷。
此改動減少推論時間，也取消了獨立第二輪校對，不能宣稱摘要完整性完全相同。

同一 iPhone、同一罰單完整流程：114.942 秒 → **40.712 秒**（約縮短 65%）。
兩次皆從選圖到摘要顯示計時，不含進入頁面前的模型預載。
OCR 金額與違規關鍵字通過，新增檢查摘要保留 `600` 也通過；
這些檢查不能取代逐項核對期限與全部條件。屬單次對照，不代表所有文件效能。
報告副本：`local-inference/.runtime/iphone/fast-summary-test-result.json`，不納入 Git。
Flutter 原生路由、單輪與取消測試 4 項通過；前端測試 9 項通過，型別與分析檢查通過。

## GPU + MTP 加速（仍使用 E4B）

原生 `EngineConfig` 改為 `.gpu`，啟用 `SpeculativeDecodingConfig(mode: .on)`，
不初始化已由 Apple Vision 取代的 E4B 影像編碼器。模型檔、原文、573 字手機摘要規則、
4096 context 與 1024 輸出上限均不變，仍拒絕截斷輸出。
MTP 使用同一模型檔內的預測器加速輸出；不是額外再做一輪摘要。
參考：[LiteRT-LM 官方 MTP 說明](https://developers.google.com/edge/litert-lm/models/gemma-4)。

同一 iPhone 15 Pro Max / 同一罰單：
- CPU 單輪：40.712 秒。
- GPU 單輪：24.954 秒；模型預載另 17.816 秒。
- GPU + MTP 第一輪：13.779 秒；模型預載另 3.581 秒。

GPU + MTP 第一輪輸入 1597 tokens、輸出 214 tokens，SDK 回報解碼 36.83 tokens/秒。
預載會受已編譯快取影響，首次安裝或清除快取可能更久；不能將此次 3.581 秒當冷啟動保證。
測試報告只保存耗時、字數、金額與違規關鍵字檢查、SDK 效能數字，不保存罰單原文。
20 秒內是此樣本的實測目標，不是長文、多張圖片或所有手機的服務保證。

同設定重新啟動測試第二輪：**13.762 秒**，模型預載另 2.563 秒。
兩輪都完成 OCR 與摘要顯示，OCR 金額、違規關鍵字及摘要 `600` 檢查通過。
第二輪輸入仍 1597 tokens、輸出 214 tokens；未使用摘要結果快取。
Flutter 分析無問題，4 項原生路由／單輪／取消測試通過，正常 main.dart Profile 已建置。

## 多張拍照

圖片模式提供獨立「拍照加入」按鈕，以 `capture="environment"` 請求後鏡頭。
每拍一張追加到同一份文件，可按「再拍一張」或從相簿追加；期間不自動啟動推論。
拍完按「拍好了，開始辨識與摘要」，依目前排序辨識並合併摘要。
相簿單獨多選仍保留自動辨識；拍照累積期間的相簿追加則一起等待完成按鈕。
取消拍攝不清空已選圖片，可移除與排序，維持最多 5 張、單張 20 MB、合計 50 MB。
實際相機介面由 iOS 提供；WebView 回歸以模擬相機回傳 File 驗證照片累積流程，
不等同於自動測過實體鏡頭拍攝。測試入口為 `integration_test/govclear_camera_batch_test.dart`。

多張拍照回歸在 iOS 模擬器通過：兩次相機 File 回傳累積、取消後保留、
相簿混合追加不提前推論、移除與排序、最後兩張辨識並顯示摘要。
前端 9 項測試與建置、Flutter 測試檔分析通過。
正常 iPhone App 已安裝；本輪自動啟動仍遇到 iOS 憑證／信任拒絕，
實體相機拍攝尚待使用者完成裝置信任驗證後手動確認。

## 自動六何整理

每次圖片或文字摘要完成，先顯示白話摘要，再自動從同一份完整原文產生六何資訊：
何人（對象）、何事（事項）、何時（日期期限）、何地（地點）、為何（明載原因）、如何（方式與條件）。
摘要與六何是兩次獨立推論；原有約 14 秒摘要實測不涵蓋新增加的六何產生時間。
六何提示詞在微服務 `frontend/src/assets/govclear/six-questions-policy.txt`，
透過 `sixQuestions` 原生橋接交給現有離線模型，沒有新增網路 API。

模型必須回傳六個固定 JSON 欄位，未知值為 null，前端顯示「原文未提及」。
格式錯誤、欄位缺漏與空字串會顯示重試錯誤，不將不完整輸出當成原文缺漏。
卡片可獨立複製、重新產生；取消或六何失敗保留已完成摘要。
更新原文、修正 OCR、移除或排序圖片時，摘要與六何一起清除，避免顯示舊文件資訊。
前端採文字插值顯示，不執行模型回傳的 HTML。

測試：`frontend/tests/govclearSixQuestions.test.mjs` 驗證解析與缺漏；
TownPass `integration_test/govclear_six_questions_test.dart` 驗證自動接續產生六欄、
日期與例外、原文未寫原因、取消保留與更新後清除。使用合成通知，不使用私人罰單原文。

六何真機回歸（iPhone 15 Pro Max）通過：合成短通知約 7.124 秒先顯示摘要、
13.226 秒完成摘要與六何（不含預載），驗證六卡、原文沒寫原因的 null 顯示、
完整日期、200 元、65 歲免收、兩項材料、郵寄實際收件與確認後免重交條件。
重新整理中取消會保留原摘要與已有六何，修改原文後兩者清除。
這是合成短通知結果，不是罰單、多頁文件或所有原文的時間／正確率保證。
第一輪測試發現免重交與收件條件遺漏，已加強 how 抽取規則並重測通過。
前端 11 項測試、Flutter 5 項原生測試及分析檢查通過。
手機報告 `Documents/govclear-six-test.json`；本機副本 `.runtime/iphone/six-questions-test-result.json`，不納入 Git。

## 六何「回應不完整」格式修正

原實作只有提示詞要求 JSON，模型仍可能產生自由格式，造成前端解析失敗。
手機六何現在使用 LiteRT-LM `ResponseFormat.json`，六欄必填、值為非空字串或 null，
不允許額外欄位。六何使用獨立、啟用格式約束的會話，不重用普通摘要預載會話；
該會話停用 MTP，摘要仍維持 GPU + MTP。模擬器 Ollama 也傳入相同 JSON schema。
參考：[SDK 格式約束介面](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.19.1/swift/ResponseFormat.swift)。

前端相容舊版模型的中文欄名、非空文字陣列（逐條保留）及 JSON 外說明；
不會將缺少欄位、空白答案、錯誤型別、衝突欄名或截斷 JSON 補成 null。
格式修正不代表所有文件的資訊完整性保證，仍需核對原文。

iPhone 15 Pro Max 完整介面回歸通過，短合成通知摘要 6.604 秒、兩份輸出共 19.315 秒，
不含模型預載。六何格式約束較原先自由輸出耗時，單次數字不代表其他文件與裝置。
前端 13 項測試與 Flutter 5 項原生測試通過。
新增 `integration_test/govclear_six_format_test.dart` 檢查長文件、多頁及引號內容的原生回應
可直接 JSON 解碼，不依賴前端清理；不在報告記錄原文或生成內容。

長文件／多頁引號回歸已在 iPhone 15 Pro Max 通過，兩份原生六何輸出皆能直接 JSON 解碼，
各有六個正確型別欄位。此回歸只測格式，不宣稱逐項語意完整性。
報告副本 `.runtime/iphone/six-format-stress-result.json`；完整介面報告為
`.runtime/iphone/six-format-ui-test-result.json`，兩者均不含私人原文。
