# 專案授權規劃與盤點

盤點日期：2026-11-08。

更新：使用者已選擇 AGPL-3.0。微服務自有且有權授權的程式碼已標示 AGPL-3.0-only，正式全文見 ../LICENSE，範圍見 licensing.md。TownPass 原 GPL v3 不變。以下保留初步盤點；待選政策已由此決定取代，團隊署名已確認為「拖把吃火鍋不揪」，依賴稽核仍待補齊。此盤點文件本身不是授權書。

## 已確認的本機狀態

| 範圍 | 現況 | 處理方向 |
| --- | --- | --- |
| TownPass Flutter | 根目錄 LICENSE 為 GNU GPL version 3 條文 | 保留既有授權。仍需確認上游、各檔案標頭及貢獻者授權；不能僅依條文檔判定 GPL-3.0-only 或 GPL-3.0-or-later。 |
| 微服務與 Vue | 已加入 AGPL v3 LICENSE，套件標示 AGPL-3.0-only | 自有且有權授權內容依此授權，保留既有上游條款；private 僅為套件發布設定。 |
| 內嵌 LiteRT-LM Swift | 自帶 Apache-2.0 LICENSE、來源版本說明與 Google 著作權標頭 | 保留原文件及署名，查核實際發行物的 NOTICE 與其他相依授權。 |
| Gemma E4B 權重 | 由 prepare_iphone.py 指定上游版本與 SHA-256 下載 | 依該版本的模型卡／授權檔判斷，與本專案程式碼分開記錄。 |
| RAG 資料 | 尚未確定實際資料來源與快照 | 各來源分別記錄授權、引用、更新及再散布條件。 |
| 圖片、範例、品牌與使用者文件 | 不應自動視為自有程式碼授權的一部分 | 分別盤點權利；使用者上傳資料不因上傳而變成開源素材。 |

## 已確認決策與範圍

1. 本次微服務自有且有權授權內容採 AGPL-3.0-only；TownPass 原有 GPL v3 不變。
2. 允許商用，不附加「只供展示研究」或「商用另行同意」限制。
3. 團隊署名為 Copyright (C) 2026 拖把吃火鍋不揪，既有貢獻者署名保留。
4. 上游來源及貢獻授權範圍仍需逐項盤點；倉庫擁有者不必然擁有所有內容著作權。

## 建議交付結構

- LICENSE：選定範圍的正式標準授權全文；保留既有第三方授權。
- THIRD_PARTY_NOTICES.md：實際使用／散布的第三方名稱、版本、來源、授權、聲明位置。
- MODEL_LICENSES.md：確切模型版本、下載來源、雜湊、授權與必要聲明。
- DATA_LICENSES.md：RAG 資料與範例素材來源、授權及引用要求。
- README 授權段落：說明程式碼、模型、資料、圖片與品牌的適用範圍。
- App 授權頁：隨實際發行物呈現必要聲明；不能只處理 Git 倉庫而漏掉 App 中內嵌的 Vue 資源與 Swift 套件。

已新增標準 AGPL v3 LICENSE，並在 README 與授權說明加入團隊署名；GNU 標準條文保持不變。完整依賴清單需後續依 lockfile 與實際發行物盤點，本文並非已完成的授權合規稽核。

## 授權選擇原則

- 自有且可獨立授權的程式碼，若希望允許廣泛使用與商用，可評估 MIT 或 Apache-2.0。Apache-2.0 另包含明確專利條款與再散布要求。
- 若希望維持衍生程式碼開放，可評估 GPL 類條款；網路服務需求則另評估 AGPL，不能把單純部署服務一概視為 GPL 的散布。
- Flutter 已有 GPL v3 條文，應先保留。微服務是否可獨立選授權，需檢查是否複製 GPL 程式碼、包含其衍生內容或在發行物中形成結合作品，不能只因分成兩個 repo 就認定彼此完全無關。
- 不同元件可保留不同授權；不得用根目錄 LICENSE 宣稱重新授權第三方權重、套件與資料。

## 查核來源與未完成事項

- 本機 TownPass/LICENSE：GNU GPL v3 條文；另需檢查授權聲明及上游來源。
- 本機 TownPass/ios/Packages/LiteRTLM/LICENSE、UPSTREAM.md：Apache-2.0 與 v0.19.1 來源說明。
- Apache 官方全文：https://www.apache.org/licenses/LICENSE-2.0
- GPL 官方全文：https://www.gnu.org/licenses/gpl-3.0.html
- Google Gemma 4 授權入口目前轉向 Apache-2.0：https://ai.google.dev/gemma/docs/gemma_4_license
- 實際下載之 litert-community E4B 模型固定 revision 的模型卡尚未完成讀取；不可僅用通用 Gemma 條款或產品名稱作最終結論。需查核 prepare_iphone.py 指定的 revision 及其 LICENSE／NOTICE。

正式發布前仍需補齊來源授權盤點與實際發行物的聲明及原始碼入口；有權利歸屬爭議時，應交由具資格的法律專業確認。
