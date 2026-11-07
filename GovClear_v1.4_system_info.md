# GovClear｜政府資訊理解輔助平台

## v1.4 完整系統規格書（看文件 × 問問題｜TownPass 整合版）

- **版本**：1.4.0（2026-11-07）
- **狀態**：開發基準草案；非正式政府系統，非官方認證或法律意見
- **專題主題**：數位平權 × 友善共融；「看不懂」造成的理解障礙
- **產品入口**：① 看文件（公文摘要） ② 問問題（可信來源問答）
- **推理限制**：凡屬使用者請求的模型推理（含 LLM、模型 OCR、embedding、翻譯及其他模型式能力）**只能在使用者裝置執行**；模型訓練／微調／評估與量化可使用隔離的算力機器。
- **詳細流程圖**：[`GovClear_v1.4_使用者操作流程圖.md`](./GovClear_v1.4_使用者操作流程圖.md)（含完整雙入口流程、逐頁事件、狀態機與服務序列圖）

> **使用前應先了解的界限**：本文件整合使用者提供的 `README(1).md`（TownPass 微服務範例架構）與先前 GovClear v0.10 規格。README 可驗證「範例如何做」，但沒有足夠文字證明「2026 競賽強制採用哪個前後端框架、是否可修改正式 Flutter 主程式、如何上架」等規範。指定 R2 Guide `https://pub-a320b404617948e98085be8a40093ac6.r2.dev/2026-townpass-guide/index.html` 目前未能完整讀取，故未宣稱全數符合競賽細則。新增 `govclear.*` bridge 指令、所有私有文件能力及模型均為**本專案擬議擴充**，非原始 TownPass 已提供功能。

> **v1.3 修訂優先權**：本版新增的「iOS 裝置推理與模型／RAG 套件發行規格」取代下文任何 Android、ML Kit、單模型固定配置或未定義啟動更新策略之舊敘述。iOS 為唯一 P0 目標；Android 不在本次驗收範圍。

> **v1.4 強制架構決策（高於前章不一致敘述）**：公開 RAG 的主索引建於伺服器向量資料庫；並輸出可在 iOS 離線查詢的簽章快照。每次開啟 GovClear 都向後端檢查模型／知識包最新 manifest；發現相容新版本即自動下載、驗證、測試並切換。使用者提問、私人文件與 query embedding 不傳伺服器，檢索與生成均在 iPhone 本地執行。

---

# 0. 修訂摘要與文件優先順序

## 0.1 本版產品決策及相較 v1.1 的變動

| 議題 | 原先 v1.0 三入口規劃 | v1.3 定案／建議 |
|---|---|---|
| 產品 | 證件申辦／公文摘要／提問三入口 | **僅保留看文件與問問題兩個獨立入口**；移除證件申辦的搜尋、情境問答、資格規則、準備清單和政府送件流程 |
| 互通 | 指南 ↔ 問答 ↔ 文件 | **看文件 → 針對此文件提問**；提問亦可單獨從已審核公開知識包開始 |
| 前端 | Vue 3 + Vite + TypeScript | 保留 TownPass README 範例相容方案；正式技術限制仍待確認 |
| API／DB | Fastify 5、MariaDB 11 | 保留；刪除申辦專屬 API 與資料表，知識包以官方公告／FAQ／術語為主 |
| 裝置 | Flutter iOS + WebView + 本地安全工作區 | 保留：私人文件／OCR／LLM／問答均只在裝置上處理 |
| 模型 | 可於 GPU 訓練、端上推理 | 保留；不增加雲端推理替代機制 |
| Demo | 三個獨立展示 | **兩條展示：看文件、獨立提問；展示摘要中直接追問** |

**本版刪除範圍**：`/apply/*` 全部頁面、ServiceGuide 領域與規則評估器、`services`/`guide_*` 七張資料表、`local_guide_sessions`/`local_checklist_items`、申辦專用 API、Git Issues、測試及 Demo。**保留**公開公告的行政資格／例外作為「閱讀事實」與「問答引用」，但不新增個人資格判定或證件申辦導引模組。

**規格優先順序**：本 `v1.3` > `v1.3 使用者操作流程圖` 的操作細節（若衝突以本規格安全／資料界限為準） > 先前 v0.10 文件。原 v0.10 的 PostgreSQL DDL、OpenAPI 及 pg-boss 設定**不可直接當 v1.3 可用成品**，需依本版 21 張後端邏輯表與 8 張本機表重新產生 migration 與 API 契約；本 `.md` 為系統設計，不冒稱那些舊附件已完成遷移。

### v1.2 新增：摘譯與原文對照的視覺呈現

- 摘要改為**依文件類型自動組合的圖卡介面**，不是只有一段 AI 摘要文字：包括期限、行動、條件／例外、金額、時間軸、辦理流程圖及待確認卡。
- 所有重要圖卡、時間軸節點、流程節點皆可**點擊回查同一分析版本之原文頁碼與證據座標**；原文高亮也能反向選取圖卡。
- 手機採單欄摘要＋原文底部抽屜／全螢幕模式；平板／桌面才可使用雙欄同步檢視。沒有可信步驟先後證據時顯示清單，不用箭頭暗示程序。
- 新增獨立開發附件 [`GovClear_v1.3_UI呈現與原文對照規格.md`](./GovClear_v1.3_UI呈現與原文對照規格.md)，包含 wireframe、元件契約、Mermaid、互動事件、測試案例與開發切分；該附件為本版**規範性 UI 規格**。

## 0.2 MUST／SHOULD／P0／P1

- **MUST**：驗收必要條件，未完成不可宣稱支援。
- **SHOULD**：建議設計，改動要有 ADR（Architecture Decision Record）。
- **P0**：黑客松優先完成的可操作閉環；**P1**：功能擴充或產品化硬化；**P2**：長期規劃。
- **未知／待確認**：資料不足時必須保留此狀態，不能擅自補足或把 unknown 當 false。

---

# 1. 產品目標與邊界

## 1.1 使用者需求

GovClear 只解決兩個明確的需求，兩者都可以從首頁獨立啟動：

1. **看文件**：我收到罰單、通知、補助公告、行政文件或 PDF，看不出期限、義務、例外、適用對象及應辦事項；希望取得**一頁式摘要＋可點擊的原文證據**。
2. **問問題**：我想詢問政府資訊，或針對剛才的文件追問；希望得到**回答＋引用＋不確定事項＋下一步**，而不是無來源的模型猜測。

**模組互通只允許一條明確連結**：使用者在摘要卡片點「問這份文件」，建立限縮該文件的本機 QA scope。反方向可從問答來源點回原文。**不建立**「我要辦證件／申請事項」服務流程、情境決策樹、資格核定或待辦清單。

## 1.2 使用者與管理角色

| 角色 | 需要能力 | 權限邊界 |
|---|---|---|
| 一般市民 | 閱讀公開公告、匯入自己的文件及使用問答 | 不必登入才能閱讀公開資訊 |
| 長者／低數位素養者 | 大字、簡明資訊卡、詞彙說明、清楚的證據與下一步 | 不要求額外提供身分證／家庭資料 |
| 外籍人士 | 經校對外語介面、行政術語對照 | 無覆核語言時不把草稿標成可信翻譯 |
| 後台編輯 | 新增公開來源、標註文件／公告證據、編輯 FAQ | 不能直接跳過審核發布 |
| 內容審核者 | 核對來源、條件／例外、語言及生效日期 | 看不到民眾手機上的私人文件 |
| 發布管理者 | 套件簽章、撤回、版本及權限 | 不得以管理權限執行私人文件模型請求 |
| ML 研究者 | 建標註集、訓練、量化、實機評估 | 不接收使用者私人資料、正式 API 請求 |

## 1.3 MVP 範圍

| 模組 | P0 | P1 / P2 |
|---|---|---|
| **看文件** | 匯入 1 種合成／合法來源的通知版型；圖片／PDF、本地 OCR、日期／金額／義務、原文證據、人工更正、摘要 | 更多文件版型、跨頁附件、離線 TTS、多語詳解 |
| **問問題** | 兩種 scope：**指定本機文件**或**已下載的公開官方知識包**；本機檢索、受控回答、引用、棄答、文件內追問 | 多輪跨段落整合、更多行政領域、受控多語 QA |
| 共用 | Vue H5／Flutter Bridge、公開資料 API、MariaDB、SQLite、知識包／模型包更新、離線模式、裝置推理 | 更低階機型、其他 iOS 機型、進階觀測 |
| 後台 | 已核准的官方公告／FAQ／術語來源登錄、人工核對、版本化資料包、發布及撤回 | 白名單擷取、自動差異、批次管理 |

**明確不做**：證件申辦與準備清單、資格核定、自動繳罰鍰、代理法律陳述、送出政府正式申請、查詢個人案件狀態、串接跨機關私人資料、從文件中執行 URL／工具指令、雲端 LLM 備援。

---

# 2. TownPass README 對照、相容性與待確認事項

## 2.1 README 實際描述的架構（來源事實）

使用者提供的 `README(1).md` 記載：

- Flutter iOS／Android App 以 `flutter_inappwebview` 載入 Vue 3 H5 微服務，採前後端分離。
- Web ↔ Flutter 使用 `WebMessageListener`，JavaScript 範例為 `window.flutterObject.postMessage(JSON.stringify({name,data}))`，回應藉 `message` 事件接收。
- 範例前端：Vue 3.4.21、Vite 5.2.8、TypeScript 約 5.4、Vue Router、Pinia、Tailwind 3、Axios。
- 範例後端：Node.js 22、Fastify 5、MySQL2 3；資料庫 MariaDB 11，配套 Docker Compose、Nginx、Adminer。
- README 已示範 `launch_map` 與 `share` 的訊息契約；`camera`、`notification` 等被標註「其他待定義訊息」，**不是已保證可用的 Native API**。
- Flutter 範例 `allowedOriginRules: {"*"}` 是展示用片段，**不適合作為 GovClear 私人資料橋接的正式安全設定**。
- README 服務碼範例使用 `/frontend`、`/backend`、`/data`；本專案可延伸為 pnpm workspace，但不宣稱官方強制 monorepo。

## 2.2 GovClear 的符合性矩陣

| 項目 | 本版採用方式 | 狀態 | 決策／阻塞 |
|---|---|---|---|
| Flutter 包裝 H5 | `flutter_inappwebview` | 與 README 範例架構一致 | 仍須鎖定主辦方 App commit |
| H5 框架 | Vue 3 + Vite + TypeScript | 與 README 範例一致 | 版本鎖定由 lockfile 與 CI 實證 |
| Flutter 通訊 | WebMessageListener + name/data envelope | 與 README 範例一致 | 自訂方法需要 Native 實作 |
| 後端 | Node 22 + Fastify 5 | 與 README 範例一致 | 安全補丁版本以實際 lockfile 為準 |
| DB | MariaDB 11 + mysql2 | 與 README 範例一致 | 需重寫 v0.10 PostgreSQL 遷移 |
| 裝置端 OCR／LLM | 自訂 Native 模組 | **README 沒有保證** | 必須取得可修改 Flutter App 的交付許可 |
| 修改 TownPass App | Demo 分支／受控 plugin | **競賽規範待確認** | 若禁止，H5 模式不能宣稱擁有本地推理 |
| 模型訓練 | 獨立 GPU 研發環境 | 與 README 無衝突，但非其明列能力 | 正式規範、模型授權另核查 |
| 遠端 H5 呼叫私人 Native 方法 | **禁止** | GovClear 安全約束 | 避免 XSS／跨來源讀取私人文件 |

**預設交付模式**：對外的 TownPass H5 負責公開服務與入口；使用私人公文時呼叫 `govclear.workspace.open`，Flutter 開啟 App 內 bundled 的**本機隔離工作區**，讓 OCR／模型／SQLite 全在裝置內。若競賽不允許原生擴充，僅能以純 H5 展示已審核公開公告的閱讀與 FAQ 搜尋；私人文件摘要及端上 LLM 應明確標註為獨立 Native PoC，不宣稱已嵌入正式 TownPass，不假裝在正式城市通內可用。

---

# 3. 整體系統架構與信任邊界

## 3.1 部署架構

```mermaid
flowchart TB
    subgraph DEVICE[使用者手機]
      TP[TownPass Flutter Host]
      WH[遠端 WebView: Vue 公開介面]
      LW[Bundled 本機安全工作區: Vue UI]
      BR[受限 WebMessageListener Bridge]
      NV[Native PDF / OCR / 推理 Runtime]
      SQLITE[(本機 SQLite + 私人加密文件)]
      TP --> WH
      TP --> LW
      WH -->|僅開啟工作區| BR
      LW -->|可信本機指令| BR
      BR --> NV
      NV --> SQLITE
    end
    subgraph PRODUCT[公用服務區域]
      NG[Nginx + HTTPS]
      API[Node 22 / Fastify 5]
      WK[Worker: 來源擷取／套件建立]
      MDB[(MariaDB 11)]
      OBJ[(公開資料快照與發布套件)]
      NG --> API
      API --> MDB
      API --> WK
      WK --> MDB
      WK --> OBJ
    end
    subgraph TRAIN[獨立 ML 研發區]
      DATA[合法資料 + 標註 + 隔離測試集]
      GPU[GPU 微調／量化／評估]
      REG[候選模型簽章／發布]
      DATA --> GPU --> REG
    end
    WH <-->|只讀公開 API| NG
    LW -.->|受控更新模型及公開知識包；不傳私人內容| NG
    REG -->|審核後模型檔| OBJ
```

**重要信任區分**：遠端 H5 的腳本可以隨發布改變，不應直接讀私人文件。公開 H5 只可取得 `capabilities` 和提出 `workspace.open` 的操作；真正處理文件的介面以**bundled assets**運行、無任意第三方腳本與外部網路權限，原生端逐指令驗證來源與 session。

## 3.2 模組與部署責任

| 區域 | 程式模組 | 能做的工作 | 禁止的工作 |
|---|---|---|---|
| 遠端 WebView | `web-public` | 公開公告索引、可信 FAQ、多語公開卡、開啟本機工作區 | 獲取私人原文、OCR、prompt、embedding |
| Bundled WebView | `web-local` | 文件匯入／核對、私人 QA | 直接呼叫外網，執行外部腳本 |
| Flutter／iOS | `govclear_native` | PDF、OCR、本地模型、加密儲存、資料刪除 | 在模型失效時改送雲端 |
| 後端 API | `api` | 版本化公開公告、FAQ／知識包、來源管理、審核、模型 manifest | `/chat`、`/infer`、`/document-upload` 等私人推理端點 |
| 後端 Worker | `worker` | 公開資料來源擷取、快照、版本比對、受控封裝 | 替使用者即時生成摘要／QA |
| MariaDB | `db` | 官方來源、公告／FAQ／語言／套件／審核 | 存用戶私人公文與問答內容 |
| GPU 研發 | `ml` | 合法資料微調、量化、內部評估、產出候選模型 | 提供正式產品線上推理服務 |

## 3.3 專案目錄（建議）

```text
repo/
├─ apps/
│  ├─ web-public/                # Vue3, Vite, Vue Router, Pinia, Tailwind
│  ├─ web-local/                 # 隨 App 打包的受控本機 Vue 工作區
│  ├─ api/                       # Fastify REST API 與後台管理 API
│  ├─ worker/                    # 官方公開來源擷取、打包與發布工作
│  ├─ admin/                     # Vue 後台（也可併 web-public 路由）
│  └─ townpass-demo/             # 經許可的 Flutter App 示範分支／插件
├─ packages/
│  ├─ contracts/                 # Zod / JSON Schema / OpenAPI / TypeScript type
│  ├─ rules/                     # 不依賴 UI 的文件欄位、證據及安全驗證
│  ├─ evidence/                  # PDF/OCR 座標、Fact 與引用契約
│  ├─ bridge/                    # Flutter 消息 type、client、mock transport
│  ├─ ui/                        # Vue 可複用樣式與元件
│  └─ localization/              # 詞彙表、審核模板與格式化
├─ native/
│  ├─ ios-vision/                # Apple Vision wrapper
│  ├─ local-llm/                 # llama.cpp / runtime binding（候選）
│  └─ secure-store/              # encrypted files, session handles
├─ data/
│  ├─ migrations/                # MariaDB migrations（不可使用 v0.10 PG SQL）
│  ├─ fixtures/                  # 合成公文、官方公告、公開測試問答
│  └─ schemas/
├─ ml/
│  ├─ datasets/                  # 僅 metadata，正式原文放私有資料庫
│  ├─ annotation/
│  ├─ training/
│  ├─ export/
│  ├─ evaluation/
│  └─ manifests/
├─ tests/{unit,integration,contract,e2e,android,security}/
├─ docs/
├─ infra/{nginx,compose,backup}/
├─ pnpm-workspace.yaml
└─ README.md
```

---

# 4. 前端互動與畫面資訊架構

## 4.1 核心 UI 原則

1. 首頁呈現 **「看文件」與「問問題」兩張同等權重入口卡**；不在首頁插入申辦項目目錄。
2. 看文件必須完整展示「上傳／拍照 → 預覽 → OCR → 欄位核對 → 摘要 → 原文證據」；摘要頁提供「針對此文件提問」。
3. 問問題必須先選 **公開資料知識包**或**使用者明確指定的某份本地文件**；前者可以獨立使用，後者需取得本機授權。
4. 高風險結果區分 **核對完成、條件式、待確認、資料過期**；不得只靠顏色辨識。
5. 摘要卡點出處框選**同份原始文件的相同版本**；QA 引用必須能跳回對應段落。
6. 顯示「官方來源最後核對時間」和「裝置最後同步時間」；不以其一替代另一個。
7. WebView 返回鍵、原生返回鍵、取消推理和離開工作區均需有一致的保留／刪除提示。

## 4.2 頁面路由表

| 畫面 | Route | 功能及重要控制 | 需要的資料 | 依賴服務 |
|---|---|---|---|---|
| HOME | `/` | **兩入口**、語言、模式狀態 | bootstrap、capabilities | API + Bridge |
| PUBLIC-001 | `/knowledge` | 公開公告／FAQ 主題列表、資料版本 | public package index | API／本機包 |
| PUBLIC-002 | `/knowledge/:packageId` | 已覆核內容、原文段落、來源時間 | signed public package | API／本機包 |
| DOC-001 | `/local/document/import` | 拍照／相簿／PDF | 裝置權限與檔案型別 | Native |
| DOC-002 | `/local/document/preview/:id` | 預覽、順序、附件補拍 | local document handle | Native |
| DOC-003 | `/local/document/ocr/:id` | OCR 結果、手動修正 | source blocks | Native + SQLite |
| DOC-004 | `/local/document/review/:id` | 高風險欄位核對 | Facts + Evidence | Native rules |
| DOC-005 | `/local/document/summary/:id` | 義務／期限／例外／下一步／**問這份文件** | SummaryCards | Native + SQLite |
| DOC-006 | `/local/document/evidence/:id/:factId` | 原文定位與框選 | Evidence bbox | Native |
| ASK-001 | `/ask` | scope 選擇：已審核公開包／明確選取文件 | package index／local document list | Local + API |
| ASK-002 | `/local/ask/session/:id` | 問題輸入、停止、引用、清空 | local session | retrieval／local model |
| ASK-003 | `/local/ask/sources/:referenceId` | 原文段落、來源版本、有效日期 | source blocks | Native or local package |
| SETTINGS | `/settings` | 語言、大字、模型、資料包、隱私 | local preferences、manifests | Local + API |
| ADMIN | `/admin/*` | 公開來源、FAQ、語言、知識包發布 | authorized records | API |

**部署界線**：`/local/*` 僅存在 bundled 本機工作區，不會由遠端 H5 提供私人文件 URL。遠端 H5 只可展示已發布公開內容、查詢已覆核 FAQ，或呼叫授權的 `workspace.open` 進入本機工作區；**不可遠端上傳私人文件作推理**。若競賽禁止 Native 擴充，必須在 UI 明確呈現能力限制，不能虛構本地分析功能。

## 4.3 首頁操作流程（概覽）

```mermaid
flowchart LR
    A[進入 GovClear] --> B{選擇要做什麼}
    B --> D[看文件]
    B --> E[問問題]
    D --> G[拍照或匯入、核對、取得摘要與原文證據]
    G -->|針對此文件追問| H[限縮文件範圍問答]
    E --> I{選問答範圍}
    I -->|公開知識包| J[離線知識檢索與引用]
    I -->|指定文件| H
    H --> K[回答、引用、待確認、下一步]
    J --> K
```

完整逐頁 CTA、進度、錯誤分支及服務序列，請見 `GovClear_v1.4_使用者操作流程圖.md`。

## 4.4 摘譯／原文對照 UI 呈現標準（v1.2）

**呈現元件**：`DocumentHeader`、`ActionHeroCard`、`DeadlineCard`、`TimelineView`、`ProcedureFlow`、`EligibilityConditions`、`PaymentInfoCard`、`UncertaintyCard`、`SourceViewer`、`EvidenceBottomSheet`。不是每份文件都強制顯示流程圖或時間軸；必須由已核對資料決定適用性。

| 情境 | 使用者看到的主要 UI | 點擊後的行為 | 保護條件 |
|---|---|---|---|
| 交通罰單／到案通知 | 行動／日期／金額圖卡＋待確認 | 「查看原文」開啟正確頁面、原始欄位高亮 | 應到案日不得改稱繳費日 |
| 補助／公告 | 條件卡、例外卡、期限、流程圖／步驟清單 | 點每一條件／每一步返回公告原文 | 沒有明確步驟次序只能顯示清單 |
| 行政函文 | 「文件要求什麼」重點圖卡、期限、未知項目 | 點摘要開原文，逐筆檢查責任／期限 | 不因文件分類就認定一定要辦事 |
| 資料不足／掃描模糊 | 來源頁面、需核對欄位、受限摘要 | 可補拍、更正 OCR、重跑分析 | 不製作假確定圖卡 |

手機至少有**摘要頁 → 點來源 → 同一份原文定位 → 原文反向選卡 → 返回摘要**的完整閉環。原文在裝置本地由 Native 安全 handle 提供；不得由 H5 直接獲得任意原件路徑。雙欄只在足夠寬度啟用，200% 文字縮放須維持單欄可讀。

**資料契約**：一張 `SummaryCard` 必須具有 `cardId`、`factIds[]`、`sourceAnchors[]`、`sourceStatus`、可選的 `translations{}`；`SourceAnchor` 包含 `documentId`、`analysisRunId`、`evidenceId`、`blockId`、`pageIndex`、可選的正規化 `bbox` 和 `quote`。`TimelineView`／`ProcedureFlow` 的節點同樣攜帶 `SourceAnchor`，不能只有圖形而沒有出處。

**定位失敗時**：若 bbox 不可用，顯示頁碼＋原文片段並標示「無法自動框選」；若版本 hash 不一致、頁碼無效或 quote 不相符，禁止錯誤高亮，改顯示「來源已變更／需重新分析」。

**多語**：文字語言切換不得變更 Fact 的原始日期、金額、證據 ID 或來源 hash；未經核對的端側翻譯明示「AI 輔助／待確認」，不得顯示「官方譯文」。

> 全套實際手機畫面 ASCII wireframe、資料渲染規則、雙向同步序列圖、流程圖及 18 項 UI 驗收案例，見本版 `GovClear_v1.3_UI呈現與原文對照規格.md`。


---

# 5. 功能模組 A：看文件（DocumentUnderstanding）

## 5.1 輸入處理順序

1. 於 Native 安全工作區拍攝或選取 JPEG、PNG、PDF；P0 建議單份上限 20 MiB、10 頁（為暫定實機驗收目標）。
2. 檢查 MIME magic bytes、檔案大小、頁數、密碼 PDF；使用者選檔取消不留臨時資料。
3. 建立 `documentId`、受控 `fileHandle`、頁面 hash；顯示頁面預覽，詢問背面／附件是否完整。
4. PDF 優先解析文字層；文字層不可用時**在手機端**執行 Apple Vision OCR；存文字區塊和頁面座標。
5. 在手機端按版型分類、擷取 `Fact` 候選（日期、金額、通知目的、行動、條件與例外）。
6. 驗證 `Fact` 對應證據存在，檢查日期格式、金額單位及「得／應／不得／但書」等語氣。
7. 高風險欄位（期限、義務、應到案、金額、資格）不清楚時進入人工核對，不能默默補值。
8. 產生一頁式資訊卡並連回原始圖片位置；允許點「問這份文件」進指定 document scope 的本地問答。
9. 結束時選擇本機加密保存、單次匯出或徹底刪除派生資料。

## 5.2 Document／Fact／Evidence 契約

```json
{
  "documentId": "local-doc-001",
  "versionId": "local-version-1",
  "kind": "traffic_notice_candidate",
  "sourceCompleteness": "unknown",
  "facts": [
    {
      "factId": "fact-arrival-date",
      "field": "appearance_date",
      "rawLabel": "應到案日期",
      "rawValue": "115年12月15日",
      "normalizedValue": "2026-12-15",
      "verification": "needs_user_confirmation",
      "evidenceIds": ["ev-01"],
      "semanticNotes": ["不得視為繳款截止日"]
    }
  ],
  "evidence": [
    {
      "evidenceId": "ev-01",
      "page": 1,
      "blockId": "block-01",
      "text": "應到案日期 115年12月15日",
      "bbox": [0.10, 0.22, 0.78, 0.30],
      "coordinateSystem": "normalized_0_1"
    }
  ]
}
```

**範例全為合成資料**。`verification` 建議枚舉：`unverified`、`needs_user_confirmation`、`user_confirmed`、`source_verified`、`conflicted`、`unsupported`。**使用者確認不代表政府核實**。欄位不得只靠 JSON 格式正確就視為證據成立。

## 5.3 摘要卡片產生順序

文件種類與來源 → 使用者要做的事情 → 重要期限及原名 → 費用／應備資料 → 條件及例外 → 不確定資訊 → 官方聯絡與出處。無關欄位不顯示假內容；不得把「應到案日期」自動轉成「繳費期限」，也不能從「得不受理」改寫成「一定不受理」。

### 5.3.1 何時顯示圖卡、時間軸、流程圖

- **圖卡**：每個重要的日期、金額、應辦行動與例外需有可回查的 `SourceAnchor`；缺原文時只顯示待確認卡，不出肯定答案。
- **時間軸**：只有事件的日期類型及相互順序都能從原文或已審核資料確認，才將事件連成箭頭；否則維持獨立日期卡。
- **流程圖**：只有明確的官方前置條件／先後順序才能形成 `FlowStep.predecessorIds`；其餘以無順序清單表示。
- **條件圖卡**：條件中必須保留 `AND`／`OR`、排除、例外及「得／應／不得」的語氣，無法驗證時不得給出資格結論。
- **視覺失效降級**：所有圖表都有可操作的等價文字清單，TalkBack 可依順序朗讀，放大 200% 時仍能單欄閱讀。

**開發優先級**：先實作 `SummaryCard` 與 `SourceViewer` 雙向定位，再做時間軸、流程圖和多語版型；完整元件契約見 v1.2 UI 附件。

## 5.4 異常、取消與重分析

- 文件照片太模糊：允許重新拍攝，保留原件比較並提示未核對欄位。
- 少了附件或背面：`sourceCompleteness=missing_pages`，限制可能受影響的結論。
- OCR 日期錯誤：人工更正必須保留更正前值、建立新的 `analysisRunId`、讓舊摘要和翻譯失效。
- 模型載入失敗：進入「基本模式」保留原文檢視、PDF 文字解析、可用的本地 OCR 與手動欄位標記。
- 工作取消：取消 token 生成，保留可選原件，不顯示假完成；離開工作區撤銷 file handle。
- 刪除：移除原件、OCR、Facts、embedding、縮圖、分享暫存、對話索引及提醒，並可驗證清除結果。

---

# 6. 功能模組 B：問問題（GroundedLocalQA）

## 6.1 資料範圍是必填，不讀取整台手機

| 範圍類型 | 資料來源 | 可回答例子 | 不可擅自回答 |
|---|---|---|---|
| **公開資訊** | 已審核且**已下載**的官方公告、FAQ、行政術語知識包 | 「這份公告的申請期限是哪一天？」 | 尚未下載、已撤回或不在包內的法規與資訊 |
| **指定文件** | 使用者明確選取之 `documentId`、`analysisRunId` 與 Evidence | 「通知有沒有要求本人到場？」 | 文件未記載的法律例外、現行個人案件狀態 |

首頁獨立問答使用者須選公開主題包或在本機工作區選文件；從文件摘要按「問這份文件」則自動帶入**同一份文件、同一版分析**，並顯示來源徽標。不可預設掃描所有手機文件；切換 scope 時需建立新 session 或強制重新檢索，不沿用前一範圍的答案。

## 6.2 問答管線

`選範圍 → 確認資料包可用 → 問題整理 → 本地檢索 → 取得證據 → 可選本地 LLM 生成 → 引用與條件校驗 → 回答／追問／拒答`。

**建議答案格式**：`answer`、`citations[]`、`unknowns[]`、`nextActions[]`、`safetyStatus`、`sourceVersionIds[]`。若證據不足，`safetyStatus=insufficient_evidence` 並呈現可查證管道；不能以「常見情況」補出高風險法律結論。

```json
{
  "sessionId":"local-qa-1",
  "scope":{"kind":"document","documentId":"doc-1","analysisRunId":"run-2"},
  "question":"這份通知有要求我本人到場嗎？",
  "answer":"所選文件沒有明確說明是否須本人到場，無法確認。",
  "citations":[{"documentId":"doc-1","analysisRunId":"run-2","blockId":"block-13"}],
  "unknowns":["是否必須本人到場"],
  "safetyStatus":"insufficient_evidence",
  "nextActions":[{"kind":"open_source","referenceId":"block-13"}]
}
```

## 6.3 本地檢索與模型策略

- P0 優先 `SQLite FTS5` 或本機 prefix/keyword、source block ID、官方 FAQ 與章節索引；可用規則模板完成初始回答。
- 若安裝本地 embedding／reranker，仍屬模型推理，**不傳伺服器**；需要量測額外 RAM／磁碟與冷啟動時間。
- LLM 僅以檢索的證據組織候選句，輸入已限縮 context；不可開放一般工具呼叫、讀外部 URL、生成付款網址。
- 多輪對話每輪重驗來源版本。使用者改變資料範圍時，舊答不轉成新範圍的證據。
- 無網路時可用已安裝包，未下載的知識包不能假裝查過；須顯示來源最後同步時間。

---
# 7. 後端模組、資料流與 Worker

## 7.1 模組化單體，而非把每個頁面拆一個伺服器

建議維持一個 Fastify API 服務與一個可獨立啟動的 Worker，依資料領域切 package／service，避免黑客松時為微服務而微服務。

| 後端模組 | 資料範圍 | 公開／後台職責 | 注意事項 |
|---|---|---|---|
| `source` | 來源白名單、官方 URL、擷取快照、引用區塊 | 受限來源登錄及歷史 | 嚴格 SSRF 防護 |
| `knowledge` | FAQ、公告、詞彙、官方段落、檢索包 | 管理受控文句、建立離線檢索包 | 不接私人 prompt |
| `localization` | 外語術語、受控模板、審核 | 逐語審核、撤回 | source 變更需標 stale |
| `package` | 已發布資料包、模型包版本、manifest、簽章 | 公開 manifest／下載索引 | 應做不可變發行、原子更新 |
| `review` | 編輯／審核／發布記錄 | 簽核狀態機、角色分離 | 審核不得只靠前端旗標 |
| `admin-auth` | 後台管理帳號與 session | 登入、CSRF、role-based access | 不等於 TownPass 民眾 SSO |
| `observability` | 匿名公開服務計數、系統指標 | 健康、延遲、下載失敗 | 不記使用者私人文件或問答 |
| `ingest-worker` | 已允許的公開來源 | 網址抓取、快照、hash、候選段落建立 | 不對民眾進行模型推理 |

## 7.2 管理端工作流程

```mermaid
flowchart LR
    A[編輯登錄來源] --> B[允許清單／SSRF 驗證]
    B --> C[公開原文快照與版本 hash]
    C --> D[人工校對 Fact / FAQ / 行政術語 / 多語]
    D --> E[規則及來源證據驗證]
    E --> F[審核者簽核]
    F --> G[產生不可變離線資料包]
    G --> H[管理者簽章並發布]
    H --> I[手機更新管理器驗證後啟用]
```

### 背景工作（DB job table）

採 MariaDB 範例時，不使用 PostgreSQL 專用 pg-boss。P0 可使用 `job_queue` 表與獨立 Worker process，支援 `queued`、`leased`、`completed`、`failed`、`dead_letter`。取得 job 時在 transaction 內以 `FOR UPDATE SKIP LOCKED`（須以實際 MariaDB 11 次版本測試其支援與行為）或安全的 lease compare-and-swap 實作，確保不重複副作用。每項操作需記 `attempts`、`max_attempts`、`next_attempt_at`、`lease_owner`、`lease_until`、`idempotency_key`。若 P0 只處理單一資料來源，亦可先用受控 CLI + admin trigger，待測試後才啟用非同步佇列。

### 公開來源抓取政策

- 只有管理者已核准的 HTTPS 精確 host/path，拒絕 localhost、loopback、內網、metadata IP、私有 IPv6、非核准 port。
- DNS 解析前後／每次 redirect 都重新檢查；限制 redirect、大小、解壓尺寸、HTML parser 資源。
- 不執行來源頁面 JavaScript、不自動 follow 外部 iframe／圖片／下載。
- 保存來源 URL、抓取時點、原始 bytes hash、content-type、相對有效期、使用授權與原文快照。
- 不建立面向一般使用者的「任意貼網址讓後端抓」端點，以免 SSRF 與未審核資料直接進答案。

---

# 8. 資料來源、資料準備與標註規格

## 8.1 資料分類與取得方式

| 資料類別 | 必備欄位／內容 | 來源建議 | 取得與審核方式 | P0 範圍 |
|---|---|---|---|---|
| 行政通知版型 | 通知名稱、欄位名稱、頁面定位、例外欄 | 合成通知，或有權使用的脫敏樣本 | 人工建立 profile 與 OCR 標註 | 1 版型 |
| 公開公告 | 生效日、資格、排除、附件、聯絡 | 政府開放公告／補助頁 | 版本快照、權利、來源追蹤 | 1–2 篇核對來源 |
| 法規與行政術語 | 正式用語、白話說明、警示、外語對照 | 官方用語與審查專家 | 逐語覆核，標語意風險 | 約 20 個核心詞 |
| FAQ／問答 | 問題、回答、範圍、引文、適用版本 | 官方 FAQ＋人工結構化 | 答案不得無來源；建引用關係 | 15–30 則合成／核對 QA |
| 多語模板 | 中文事實／替代語句／插值變數 | 翻譯者與官方多語教材 | 日期金額不讓 LLM 重寫、語種獨立審核 | 繁中＋1 種覆核外語 |
| 測試資料 | PDF、圖像、金額、日期、例外／否定 | 合成文書與合法來源 | train／dev／holdout 分文件族 | 12 份 smoke，持續擴充 |
| 模型權重 | 模型 revision、license、量化、hash、相容性 | 模型原作者或合法微調產物 | 授權驗證＋實機測量 | 1 個共用文字模型候選＋基本模式；語意檢索模型為選配 |

**資料來源不是資料正確性的自動保證**：即使來自官方網站，也可能已過期、不適用某地區或被後續公告修訂。每個資料包應標示有效時間、上次審核及來源是否仍可連線。不要把「第一個搜尋結果」作為法律依據。

## 8.2 金標（golden dataset）最小格式

```json
{
  "sampleId":"fixture-001",
  "familyId":"synthetic-traffic-notice",
  "usageRights":"synthetic_owned",
  "documentSha256":"<computed at fixture creation>",
  "split":"dev",
  "documentType":"traffic_notice_candidate",
  "goldFacts":[
    {"field":"appearance_date", "value":"2026-12-15", "evidenceBlockIds":["block-1"]}
  ],
  "mandatoryUnknowns":["payment_deadline","must_appear_in_person"],
  "criticalConditions":["不得由應到案日期推定其他日期"],
  "reviewStatus":"double_reviewed"
}
```

- `test` 資料不可用來調參或作為模型 prompt 範例反覆調整；同一份文件的旋轉、翻譯、裁切版本要在相同 split。
- 評估需同時報告 **coverage（可回答率）＋ error rate（錯誤率）＋ abstention（棄答率）**；不能靠全部拒答取得零錯誤。
- 每筆高風險標註必須具備來源段落／座標，而非只有最終答案。

## 8.3 多語詞彙的風險欄位

建議詞彙表包含 `term_key`、`zh_original`、`plain_zh`、`locale`、`translation`、`domain`、`must_preserve`、`reviewer`、`reviewed_at`、`source_version`、`warnings[]`、`status`。尤其要保留：`得`、`應`、`不得`、`除外`、`不在此限`、`核准`／`受理`、`到案`／`繳款` 的區別。自動反向翻譯只能作風險訊號，**不是法律等價的證明**。

---

# 9. MariaDB 11：後端資料庫設計與資料字典

## 9.1 原則

- 使用 MariaDB 11／`mysql2`，InnoDB + `utf8mb4`、明確 PK／FK／唯一鍵；時間 UTC 儲存，行政期限另存原始文字與時區語意。
- 重要欄位不可全塞入 JSON；來源版本、證據與審核事件要能建立明確關聯與追蹤。
- `source_versions`、`package_releases`、`model_releases` 不覆寫已發布內容；更正應建立新版本，撤回以狀態標記。
- 產品後端**不儲存**私人公文、OCR、私人提問、對話、embedding 或敏感輸入。
- **本版 21 張邏輯表是資料字典草案，不是已完成的 MariaDB migration。** 實作時需依 FK 順序生成及以實際 MariaDB 容器驗證。

## 9.2 後端資料表（21 張邏輯表）

### A. 管理與審核（4）

| 表 | 核心欄位 | 主鍵／關聯與索引 | 用途 |
|---|---|---|---|
| `admin_users` | `id,email,password_hash,role,disabled_at` | PK id、UNIQUE email | 後台身份 |
| `admin_sessions` | `id,admin_user_id,token_hash,expires_at,revoked_at` | FK admin_users、INDEX expires_at | 伺服器工作階段 |
| `review_events` | `id,entity_type,entity_id,entity_version,action,reviewer_id,reason` | FK reviewer；複合查詢索引 | 審核與撤回歷史 |
| `audit_events` | `id,actor_id,action,target_type,target_id,created_at` | actor + created_at | 最小化管理稽核 |

### B. 公開來源與證據（6）

| 表 | 核心欄位 | 主鍵／關聯與索引 | 用途 |
|---|---|---|---|
| `source_policies` | `id,allowed_host,path_prefix,max_bytes,enabled` | UNIQUE(host,path) | 安全擷取白名單 |
| `sources` | `id,agency,canonical_url,title,license_status,source_policy_id,status` | FK policy、UNIQUE URL | 來源主檔 |
| `source_versions` | `id,source_id,sha256,retrieved_at,effective_from,effective_to,artifact_key,status` | FK source、UNIQUE(source,sha256) | 不可變來源快照 |
| `source_blocks` | `id,source_version_id,page_no,block_index,text_content,bbox_json,block_hash` | FK source_version、INDEX(version,page) | 引用段落、頁座標 |
| `official_links` | `id,source_id,link_type,url,verified_at,status` | FK source、UNIQUE(source,url) | 正式公告、聯絡與官方連結（非申辦流程） |
| `artifact_objects` | `id,storage_key,mime,byte_size,sha256,access_scope` | UNIQUE storage_key、INDEX sha256 | 公開快照與發行包 |

### C. 知識、詞彙及語言（5）

| 表 | 核心欄位 | 主鍵／關聯與索引 | 用途 |
|---|---|---|---|
| `knowledge_entries` | `id,source_version_id,topic_key,entry_type,canonical_question,canonical_answer,status` | FK source_version、INDEX(topic_key,status) | 官方 FAQ、公告段落、問答知識 |
| `knowledge_citations` | `id,knowledge_entry_id,source_block_id,claim_key` | FK entry/block、UNIQUE(entry,block,claim) | 知識結論對來源片段 |
| `glossary_terms` | `id,term_key,zh_original,plain_zh,domain,risk_level` | UNIQUE(term_key) | 行政術語 |
| `glossary_localizations` | `id,term_id,locale,translated_text,review_status,reviewer_id` | FK term/reviewer、UNIQUE(term,locale) | 經審核翻譯 |
| `localized_content` | `id,entity_type,entity_id,entity_version,locale,content_json,review_status,reviewer_id` | UNIQUE(entity,version,locale) | 公告／FAQ／摘要模板翻譯版本 |

### D. 發行、模型、運維（6）

| 表 | 核心欄位 | 主鍵／關聯與索引 | 用途 |
|---|---|---|---|
| `package_releases` | `id,package_key,version,kind,manifest_json,artifact_id,sha256,signature,status,published_at` | FK artifact、UNIQUE(package_key,version) | 離線公開知識包／術語包 |
| `model_releases` | `id,model_key,version,base_model_revision,quantization,runtime_abi,artifact_id,evaluation_id,status` | FK artifact、UNIQUE(model_key,version) | 本地模型發布 |
| `evaluation_runs` | `id,model_release_id,dataset_hash,device_profile,metrics_json,approved_by` | FK model_release、INDEX(created_at) | 實機品質測試 |
| `job_queue` | `id,job_type,payload_json,status,attempts,lease_until,next_attempt_at,idempotency_key` | INDEX(status,next_attempt_at)、UNIQUE(idempotency_key) | 公開來源匯入／套件封裝 |
| `idempotency_keys` | `id,scope,idempotency_key,request_hash,response_ref,expires_at` | UNIQUE(scope,idempotency_key) | 防止重複發布 |
| `telemetry_daily` | `id,service_key,event_key,locale,bucket_date,total_count` | UNIQUE(service,event,locale,date) | 僅公開端聚合統計 |

總數 **4 + 6 + 5 + 6 = 21**。已**移除**舊版 `services`、`guide_versions`、`guide_scenarios`、`guide_questions`、`guide_rules`、`guide_requirements`、`guide_steps`，且 `knowledge_entries` 不再具有 `guide_version_id` FK。

## 9.3 MariaDB DDL 片段（作為 migration 起點）

```sql
CREATE TABLE sources (
  id CHAR(36) NOT NULL PRIMARY KEY,
  agency VARCHAR(255) NOT NULL,
  canonical_url VARCHAR(2048) NOT NULL,
  title VARCHAR(255) NOT NULL,
  license_status VARCHAR(32) NOT NULL,
  source_policy_id CHAR(36) NULL,
  status ENUM('draft','approved','stale','withdrawn') NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_sources_canonical_url (canonical_url(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE knowledge_entries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  source_version_id CHAR(36) NOT NULL,
  topic_key VARCHAR(128) NOT NULL,
  entry_type ENUM('faq','official_notice','glossary_explanation') NOT NULL,
  canonical_question TEXT NULL,
  canonical_answer TEXT NOT NULL,
  status ENUM('draft','approved','published','stale','withdrawn') NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_knowledge_topic_status (topic_key,status),
  KEY idx_knowledge_source (source_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> 這是**部分建表示例**。外鍵須在依序建立 `source_policies`、`source_versions` 等依賴表後加入；不可將片段當成完整 21 表 migration。對外發布前須以真實 Docker MariaDB 測 FK、查詢、審核權限、備份與還原。

## 9.4 重要查詢與索引

1. `sources(canonical_url)`：去重與來源狀態；需測試網址長度和索引策略。
2. `source_versions(source_id,retrieved_at)`：取指定來源的發布版本。
3. `source_blocks(source_version_id,page_no)`：來源引用及頁面定位。
4. `knowledge_entries(topic_key,status)`：公開主題包資料選取。
5. `knowledge_citations(knowledge_entry_id,source_block_id)`：回答證據追蹤。
6. `package_releases(package_key,version)`、`model_releases(model_key,version)`：端上更新索引。
7. `job_queue(status,next_attempt_at)`：受控公開來源背景擷取。

---

# 10. 裝置本機資料儲存：SQLite + 私人加密文件

## 10.1 資料分區

- **Public cache**：可更新的公告、術語、FAQ、公開 knowledge package，可用快取保存，來源撤回需停用。
- **Private vault**：私人 PDF／圖片、OCR、摘要及 QA，以 App 私有沙盒儲存；敏感檔案加密，金鑰使用 OS keystore／平台安全儲存處理。
- **Models**：量化模型檔與其簽章 manifest 存隔離 asset 目錄；不是 SQL BLOB；更新須原子切換。

## 10.2 本機資料表（8 張）

| 表 | 重要欄位 | 用途與保存規則 |
|---|---|---|
| `local_documents` | `id,display_name,encrypted_path,sha256,mime,page_count,created_at,save_policy` | 私人文件；可選單次使用或本機保存 |
| `local_pages` | `id,document_id,page_no,preview_path,width,height,hash` | 頁影像與縮圖 metadata |
| `local_source_blocks` | `id,document_id,page_id,block_index,text,bbox,extractor_version` | 原文文字塊、頁面座標 |
| `local_analysis_runs` | `id,document_id,model_hash,profile_version,rule_version,status,created_at` | 不可變分析紀錄 |
| `local_facts` | `id,analysis_run_id,field,raw_label,raw_value,normalized_value,verification,evidence_refs` | Fact 與證據對應 |
| `local_qa_sessions` | `id,scope_kind,scope_ref,retention,created_at` | 問答範圍與保存政策 |
| `local_qa_messages` | `id,session_id,role,content_encrypted,citations_json,verification,created_at` | 問答與引用，可刪除 |
| `local_packages` | `id,kind,version,artifact_sha256,signature_valid,installed_at,status` | 模型／公開資料／翻譯包狀態 |

**資料庫約束**：`local_qa_sessions.scope_kind ∈ {document, public_package}`，文件 scope 需引用同裝置上實際存在的 `documentId`＋`analysisRunId`；公開 scope 必須對應已安裝、已審核且有效的版本。引用不可包含任意檔案路徑。刪除文件時須清除與該文件綁定的 QA session、訊息、索引及衍生檔案。

### SQLite 核心範例

```sql
PRAGMA foreign_keys = ON;
CREATE TABLE local_documents (
  id TEXT PRIMARY KEY,
  encrypted_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mime TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE local_qa_sessions (
  id TEXT PRIMARY KEY,
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('document','public_package')),
  scope_ref TEXT NOT NULL,
  retention TEXT NOT NULL CHECK (retention IN ('ephemeral','saved')),
  created_at TEXT NOT NULL
);
CREATE TABLE local_qa_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content_encrypted BLOB NOT NULL,
  citations_json TEXT NOT NULL CHECK (json_valid(citations_json)),
  verification TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES local_qa_sessions(id) ON DELETE CASCADE
);
```

**SQLite 範例只涵蓋三張表；其餘五張需依資料字典完成 migration、加密與刪除級聯測試。**

**注意**：若 UI 透過純 WebView localStorage 暫存私人內容，則難以保證 OS 金鑰與安全刪除。GovClear 的私有內容必須由受控 Native storage 管理；前端只持有短效 handle，退出後銷毀。

---
# 11. REST API 規格（產品後端只處理公開資料）

## 11.1 共通設計

- Base URL：`/api/v1`；公開 API 透過 HTTPS，不必要求民眾登入。後台 API 使用獨立管理 session、CSRF 防護與角色權限。
- JSON 應包含 `schemaVersion`、`data`、`meta`（如 `sourceVersions`、`generatedAt`、`nextCursor`）及必要時 `errors[]`。
- `ETag`／`If-None-Match` 與快取 TTL 只用於**公開已發布版本**；撤回清單需能被下次同步確認。
- 不接受客戶端自傳 `isReviewed=true`、`published=true`、`role=admin`，伺服器要依授權及狀態機自行驗證。
- 後端不得提供 `POST /chat`、`POST /infer`、`POST /ocr`、`POST /documents/private`、`POST /embeddings` 或「推理失敗後上傳」路徑。

## 11.2 公開讀取 API

| Method | Path | 用途與輸出 |
|---|---|---|
| GET | `/health` | API 存活狀態 |
| GET | `/api/v1/bootstrap` | 產品支援功能、公開包索引版本、公告 |
| GET | `/api/v1/knowledge/topics` | 已審核公開主題（供獨立提問選擇） |
| GET | `/api/v1/knowledge/packages` | 依 locale、topic 查已發布知識包 metadata |
| GET | `/api/v1/sources/:sourceVersionId` | 來源機關、版本、效期、hash、狀態 |
| GET | `/api/v1/sources/:sourceVersionId/blocks/:blockId` | 允許公開引用的原文區塊／頁位置 |
| GET | `/api/v1/packages/:releaseId/manifest` | 已發布簽章知識包、語言包 manifest |
| GET | `/api/v1/packages/:releaseId/file` | 唯讀版本化 package 二進位檔 |
| GET | `/api/v1/models` | 平台相容的裝置模型列表 |
| GET | `/api/v1/models/:releaseId/manifest` | 模型來源、授權、大小、簽章、相容版本 |
| GET | `/api/v1/models/:releaseId/file` | 量化模型二進位檔下載（不推理） |
| GET | `/api/v1/glossary` | 已審核行政詞彙與語言版本 |

若來源已撤回，metadata 必須回傳明確 `withdrawn`，而非繼續提供當前可信狀態。這些為**本專案擬議 API**，不是 TownPass README 既有 endpoint。

## 11.3 管理端 API

| Method | Path | 主要用途 | 後端檢查 |
|---|---|---|---|
| POST | `/api/v1/admin/login` | 管理者登入 | rate limit、session、CSRF |
| POST | `/api/v1/admin/logout` | 撤銷登入 | token hash、session revoke |
| POST | `/api/v1/admin/sources` | 登錄官方公開來源 | editor、URL allowlist、權利狀態 |
| POST | `/api/v1/admin/sources/:id/snapshots` | 觸發公開來源擷取 | job idempotency、SSRF |
| POST | `/api/v1/admin/knowledge` | 新增 FAQ／公告知識草稿 | editor、來源 evidence 存在 |
| PATCH | `/api/v1/admin/knowledge/:id` | 修訂尚未發布的知識 | ETag、schema、版本策略 |
| POST | `/api/v1/admin/knowledge/:id/submit-review` | 送審 | 必要來源、條件與例外完整 |
| POST | `/api/v1/admin/knowledge/:id/approve` | 覆核 | reviewer、來源確認、職責分離 |
| POST | `/api/v1/admin/packages` | 建立離線知識包候選 | 核准內容／語言狀態 |
| POST | `/api/v1/admin/packages/:id/publish` | 簽章並發布版本 | publisher、授權、相容性 |
| POST | `/api/v1/admin/releases/:id/withdraw` | 撤回公開版本／模型 | 理由、版本不可變、發布紀錄 |
| POST | `/api/v1/admin/localizations/:id/review` | 多語審核 | 語言、來源證據、覆核者 |

所有管理 API 需寫 OpenAPI、Zod schema、角色權限與負向測試。不得建立 `/chat`、`/infer`、`/ocr`、`/private-document-upload` 等產品雲端推理服務。

## 11.4 公開知識包契約示例

```json
{
  "schemaVersion": "1.1",
  "packageId": "public-notices-demo",
  "version": "1.0.0-demo",
  "topic": "行政通知解讀",
  "status": "published",
  "sourceVersions": ["synthetic-source-v1"],
  "entries": [{
    "entryId": "faq-01",
    "question": "文件有應到案日期就代表繳費期限嗎？",
    "answer": "不能直接認定相同；應分別確認通知所載日期及義務。",
    "citations": [{"sourceVersionId": "synthetic-source-v1", "blockId": "block-01"}],
    "reviewStatus": "approved"
  }],
  "meta": {"generatedAt": "2026-11-07T00:00:00Z", "synthetic": true}
}
```

> 此為**合成資料契約示例**，不是正式法規或政府公告。正式來源必須經過來源與權利審核。

## 11.5 錯誤回應

```json
{
  "schemaVersion":"1.0",
  "errors":[{
    "code":"SOURCE_WITHDRAWN",
    "message":"引用來源已撤回，請確認主管機關最新資訊。",
    "retryable":false,
    "traceId":"public-error-id"
  }]
}
```

常見錯誤類別：`VALIDATION_FAILED(400)`、`NOT_FOUND(404)`、`SOURCE_WITHDRAWN(410)`、`EDIT_CONFLICT(409)`、`TOO_MANY_REQUESTS(429)`、`PACKAGE_NOT_COMPATIBLE(422)`、`SOURCE_POLICY_DENIED(403)`、`TEMPORARY_UNAVAILABLE(503)`。公開錯誤回應不得洩露 DB URL、絕對路徑、SQL、管理員 token。

---

# 12. Flutter ↔ WebView Bridge 協定（對照 README）

## 12.1 原始通訊格式與新增欄位

README 的格式為：

```ts
window.flutterObject.postMessage(JSON.stringify({
  name: 'launch_map',
  data: 'https://maps.example.invalid/'
}));
```

GovClear **沿用 `name`、`data` 兩個外層欄位**，在 `data` 內加入請求識別、版本與型別化 payload；**不修改 README 已有的 `launch_map`、`share` 語意**。

```ts
type GovClearBridgeRequest<T> = {
  name: string; // govclear.*，不是 README 已實作的指令
  data: {
    protocolVersion: '1.0';
    requestId: string;
    payload: T;
  };
};

type GovClearBridgeResponse<T> = {
  name: 'govclear.response';
  data: {
    requestId: string;
    ok: boolean;
    payload?: T;
    error?: { code: string; message: string };
  };
};
```

## 12.2 新增命令與作用域

| 指令 | 可用來源 | 輸入 | 回應 | 安全控制 |
|---|---|---|---|---|
| `govclear.capabilities.get` | 核准遠端 H5 + 本機工作區 | `{}` | mode、支援 OCR／模型、版本 | 不回私人資訊 |
| `govclear.workspace.open` | 核准遠端 H5 | `{intent}` | opened/cancelled | Flutter 開啟 bundled workspace，不回內容 |
| `govclear.local.document.import` | **僅 bundled workspace** | `kind: camera / picker / pdf` | local documentHandle | 原生檔案選擇器，權限與型別檢查 |
| `govclear.local.document.preview` | 僅 bundled | documentHandle + page | 短效 viewer handle | 避免任意檔案 path |
| `govclear.local.analysis.start` | 僅 bundled | documentHandle、profileId | workId | 不接受 arbitrary system prompt |
| `govclear.local.analysis.status` | 僅 bundled | workId | progress、status、warnings | 工作綁定 session |
| `govclear.local.analysis.cancel` | 僅 bundled | workId | cancel_requested | 可中止推理並釋放資源 |
| `govclear.local.presentation.get` | 僅 bundled | `documentId`、`analysisRunId` | 已驗證卡片／時間軸／程序 DTO | 不暴露任意原件路徑，版本／來源檢查 |
| `govclear.local.evidence.get` | 僅 bundled | `documentId`、`analysisRunId`、`evidenceId`（或對應 `factId`） | page、blocks、bbox、quote、短效 viewer handle | 限同一分析版本、驗證座標與原件 hash |
| `govclear.local.document.correct` | 僅 bundled | factId、correctedValue | new analysisRunId | 建新版本並廢止舊摘要 |
| `govclear.local.ask.run` | 僅 bundled | sessionId、question | workId／事件 | scope 限制且本地推理 |
| `govclear.local.ask.cancel` | 僅 bundled | workId | cancel_requested | 停止生成 |
| `govclear.local.document.delete` | 僅 bundled | documentId | deletion result | 含派生檔案與索引 |
| `govclear.local.packages.status` | 核准遠端只讀／bundled | `{}` | installed manifest metadata | 不回私人資料 |
| `govclear.local.packages.install` | **僅受信任下載管理介面** | releaseId | workId | 白名單、簽章、size、disk check |

原生 `Event` 建議包含 `{requestId, workId, stage, sequence, progressPercent?, payload?}`。大影像及完整 OCR 不透過一般遠端 WebView 的 Bridge 傳送，僅回短效安全 handle。

## 12.3 Web 端 Bridge Adapter（Vue 可直接作為骨架）

```ts
// packages/bridge/client.ts  — 設計示例，仍須與指定 Flutter 分支整合測試
export type BridgePayload = Record<string, unknown>;
export function postGovClearMessage(
  name: string,
  payload: BridgePayload,
  requestId: string,
): boolean {
  const nativeObject = (window as Window & {
    flutterObject?: { postMessage(message: string): void };
  }).flutterObject;
  if (!nativeObject) return false;
  nativeObject.postMessage(JSON.stringify({
    name,
    data: { protocolVersion: '1.0', requestId, payload },
  }));
  return true;
}
```

前端應以**單一 Bridge service 實例**監聽 message，再依 `requestId` 派送回應；不要每個 Vue 子元件自行註冊全域 listener，否則容易重複觸發。加入 request timeout、取消、頁面卸載取消訂閱；不能依序列化的 `name` 直接反射執行任意 Native 方法。

## 12.4 Flutter 端驗證

1. 僅允許受信任 Scheme／Host／Port、主框架與本機 bundled 工作區。`allowedOriginRules: {"*"}` 僅出現在參考 README 示意，正式 Bridge 不使用萬用字元。
2. 在 `onPostMessage` 依 command whitelist 驗證 `name`，對 `data` 執行 schema 檢查、長度限制、requestId 與 session 權限檢查。
3. `local.*` 只能由安全工作區執行；遠端 H5 即使有 `flutterObject` 也不能取得 document handle。
4. 檔案挑選與分享要有使用者明確手勢，不能從文件內的惡意字串自動觸發。
5. 大任務用進度事件，禁止長時間阻塞 WebView 主執行緒；Flutter iOS plugin 應在受控背景執行緒處理 OCR／LLM。
6. 工作區被銷毀、App 進背景或權限撤回後，應失效其 session token 與檔案 handle。

---

# 13. 本地模型、GPU 訓練及發行規格

## 13.1 最重要的不變條件

**正式使用者觸發的模型推理必須在裝置端。** 包括 OCR 若採模型、LLM、向量 embedding／reranking、翻譯與模型 TTS。取得公開知識包、下載模型及讀取版本 metadata 可以連線，但**不能將私人原文、prompt、embedding、摘要、QA 內容交給產品伺服器運算**。

GPU 算力機器可用於：合法資料整理、模型 fine-tuning、LoRA／QLoRA（依相容性）、訓練期間驗證、匯出與量化，及研發階段品質比較。它沒有公開推理 API，不接受產品 App 的動態問答或文件處理請求。若研究上使用教師模型產生訓練資料，需另外審視使用授權及競賽規範，不可直接把它當成使用者端推理的例外。

## 13.2 本地 Runtime 候選

- Flutter Host：使用競賽核准的分支及原生擴充方式。
- iOS OCR：Apple Vision `VNRecognizeTextRequest`（檢查繁中語系、離線可用與頁面定位）。
- PDF：先讀文字層，圖片頁面才啟動 OCR；拒絕執行嵌入 JavaScript。
- LLM：以 `llama.cpp` iOS Metal／Swift wrapper（或 MLX Swift LM 擇一） 與一個可部署的小模型作初始候選；不把單一模型宣稱為所有語言的最佳解。
- 推理策略：在受限上下文中產候選 Facts 或根據檢索結果產候選回答；最終仍由規則、Evidence check 與來源有效性校驗。
- 索引：P0 可用 SQLite FTS5，避免為了 RAG 立即引入嵌入模型和額外記憶體負擔。

**實機最低測試矩陣建議**：一台黑客松展示機＋一台較低 RAM 裝置；記錄 iPhone 型號、iOS 版本、記憶體、CPU、模型 hash、峰值 RSS、OCR p95、端上 QA p95、溫升與失敗率。不要未測就宣稱「所有手機都能使用」。

## 13.3 模型訓練資料與驗證目標

| 工作 | 模型輸入 | 預期輸出 | 安全驗證 |
|---|---|---|---|
| 文件種類分類 | 原文片段／版面摘要 | 支援版型或 unknown | 未支援類型必須拒判 |
| 欄位擷取 | 原文區塊 ID 和文字 | Fact 候選＋對應 evidence block | 日期、金額、原標籤一致 |
| 條件／例外 | 已標註來源段落 | all／any／not 及例外關係 | `得` 不變 `必須`、不漏「但」 |
| 受控白話 | 已核對 Facts／模板 | 簡短易讀文句 | 不重寫金額、日期、不保證核定 |
| Grounded QA | 所選問題＋檢索證據 | 回答＋引用＋未知 | 證據不足就 abstain |

訓練資料應使用已核准公開文件、合法去識別資料或合成資料；使用者實際上傳的公文與問答不進入訓練資料庫。按文件族群分 train/dev/test，避免相同通知不同角度的影像跨 split。

## 13.4 訓練→發布流程圖

```mermaid
flowchart TD
    A[官方合法資料／合成樣本] --> B[標註來源、Facts、例外與未知]
    B --> C[按文件族分割 train/dev/test]
    C --> D[GPU 微調／候選實驗]
    D --> E[匯出並轉換裝置格式／量化]
    E --> F[指定 iOS 實機測試]
    F --> G{品質與資源門檻通過?}
    G -->|否| H[拒絕發布／恢復基底或基本模式]
    H --> D
    G -->|是| I[內容與授權審核]
    I --> J[模型 manifest + SHA256 + 簽章]
    J --> K[公開下載版本索引]
    K --> L[手機下載、校驗、原子啟用]
    L --> M[手機離線推理]
```

## 13.5 Model manifest 必要欄位

```json
{
  "schemaVersion":"1.0",
  "modelKey":"govclear-extractor",
  "modelVersion":"0.1.0-demo",
  "inferencePolicy":"device_only",
  "format":"gguf",
  "runtime":"llama.cpp-android",
  "baseModelRevision":"<exact revision after selection>",
  "trainingRunId":"<internal run id>",
  "datasetManifestSha256":"<computed>",
  "artifactSha256":"<computed>",
  "signature":"<publisher signature>",
  "supportedTasks":["document_extract","grounded_qa"],
  "minAppVersion":"<verified compatible version>",
  "maxContextTokens":2048,
  "evaluationReportId":"<approved evaluation id>"
}
```

`<...>` 是待計算／待填入的占位符，不能把此 JSON 當作已發布的真實模型證書。Package manager 應驗證發行者簽章、公鑰／key rotation、檔案 hash、相容性及最小磁碟空間。下載中斷或自測失敗不得覆寫已啟用版本；已撤回模型不應被當作回退目標。

## 13.6 模型不可用時的產品行為

- 已下載的官方公告／FAQ、術語表、原文檢視與來源搜尋不依賴 LLM，仍可正常使用。
- 文件保留 PDF 原文閱讀、支援的 OCR／手動欄位校正；不能在模型缺失時假裝已生成可信的自由摘要。
- 提問降級為已核對 FAQ／術語搜尋與原文推薦，不生成沒有依據的新答案。
- 高風險內容在沒有證據／未通過校驗時，顯示「目前無法確認」，並提供正式來源。

---

# 14. 多語與友善閱讀設計

## 14.1 語言原則

- UI 語言與文件內容語言分開設定。初期選一種已有翻譯者覆核的外語＋繁體中文，不宣稱英文、印尼文、越南文、泰文全部已通過品質測試。
- 公開公告的經審核說明由**相同的結構化 Facts**經審核模板產出多語；重要期限和金額由 formatter 插入而不是模型自由重寫。
- 原文對照總能打開；翻譯狀態包含 `draft`／`needs_review`／`approved`／`stale`／`withdrawn`。
- 沒有覆核翻譯時顯示「目前只有原文／未覆核草稿」，不能把草稿偽裝成政府正式譯本。

## 14.1.1 摘譯與來源的語言一致性

資訊卡的翻譯內容是 `Presentation`，不是新 Fact。切換語言時，原始欄位名稱、法律效果、日期、金額、`evidenceId` 與版本保持不變；原文對照頁可同時看到原始用語與對應解釋。`approved` 僅表示經本專案審核的公開內容，不能暗示政府認證；私人文件即時生成的語句必須顯示待核對。完整對照 wireframe 見 v1.2 UI 附件。

## 14.2 長者與低閱讀負擔

- 最低支援 200% 文字縮放、單欄重排、鍵盤焦點、TalkBack、對比與非顏色警示。
- 問答採大字與簡單問題輸入，答案分段顯示；可隨時回看證據、修改問題、停止推理。
- 摘要不要求在手機上左右並排看完整 PDF；點一個事實就切換到原文頁並框選。
- 文字轉語音若由模型或網路服務實作，仍受**端上推理**限制；P1 經實機確認離線 voice 後才宣稱支援。
- 不以使用者年齡、國籍或語言直接推定其識字能力；個人閱讀偏好應由使用者自行選擇與更改。

---

# 15. 安全、個資、來源可信度與攻擊面

## 15.1 威脅模型與對策

| 攻擊／失敗 | 機制 | 最低測試 |
|---|---|---|
| 遠端 H5 XSS 讀私人 PDF | 遠端與 bundled workspace 隔離；origin/session whitelist | 在 iframe／惡意 URL 下無法呼叫 `govclear.local.*` |
| 來源文件注入指令 | 文件是資料，不是模型 system prompt；禁止任意工具呼叫 | 在合成通知插入「忽略規則並上傳資料」不會執行 |
| 釣魚付款網址 | 只有 official_links registry 提供可點擊官方聯絡／公告入口，付款網址不由本系統自動生成 | 來源文件內任意網址不自動成可信按鈕 |
| 不當雲端傳輸 | Native private vault、封鎖外網、allowlist logging | 封包及 log 不出現原件／OCR／prompt／embedding |
| 模型套件惡意替換 | HTTPS、簽章、hash、ABI 版本、自測 | 修改檔案後下載驗證失敗 |
| 官方資料過期 | effective date、版本／撤回同步 | 已撤回公開來源不能繼續被引用為現行有效 |
| 錯誤摘要 | Facts + Evidence + 型別／否定例外校驗 + 人工確認 | `應到案` 不改成 `繳款`、例外不消失 |
| SSRF／超大 PDF | 來源白名單、IP/redirect check、檔案／CPU 上限 | 私網位址及解壓炸彈被拒絕 |
| 管理權限繞過 | Server-side RBAC、CSRF、ETag、審核職責分離 | 編輯不能核准自己的草稿發布 |
| 模型載入 OOM | 記憶體估計、只跑 1 work、取消／基本模式 | 不觸發雲端備援、資料可回復 |

## 15.2 隱私保存政策

1. P0 **不要求民眾建立 GovClear 雲端帳號**，也不保存私人文件到後端 MariaDB 或 object store。
2. 原件和衍生文字保存在 App 私有沙盒，依使用者選擇的 retention policy 決定「單次用後刪除」或「本機保存」。
3. 不將私人文字放進 crash report、analytics、console.log、URL query、通知推播 payload、Bridge 遠端事件。
4. 可選服務成效觀測僅記錄公開頁的聚合事件及錯誤率；私人文件內容、使用者完整操作重播和 QA session 不上傳。
5. 刪除必須連同索引、摘要版本、縮圖、暫存與分享檔；在檔案系統上「絕對保證不可恢復」不應未經驗證就宣稱。
6. 若未來允許受試者提供測試資料，需另建明示同意、用途、期限與撤回流程，**不能直接用 telemetry 代替授權**。

---

# 16. 狀態機、錯誤碼、版本一致性

## 16.1 領域狀態

| 領域 | 狀態 | 不變條件 |
|---|---|---|
| Public Knowledge | draft, needs_review, approved, published, stale, withdrawn | 只有經人工覆核、來源可追溯的不可變版本可以發布 |
| Document | imported, parsing, extracting, validating, needs_confirmation, ready, ready_with_warnings, cancelled, failed, deleted | 待核對不得自動轉 ready；更正建立新分析版本 |
| QA | scope_required, ready, retrieving, inferencing, validating, answered, insufficient_evidence, cancelled | 引用與答案僅限當次 scope 及版本 |
| Package | available, downloading, verifying, installed, active, stale, withdrawn, rejected | 損毀／不相容包不得切成 active |
| Model | planned, trained, device_validated, released, rejected, withdrawn | 未經實機品質測試不得發布 |

## 16.2 Native／產品共通錯誤碼

| code | 觸發 | 使用者行為 | 系統復原 |
|---|---|---|---|
| `LOCAL_RUNTIME_UNAVAILABLE` | 無原生插件／一般瀏覽器 | 僅使用公開閱讀 | 禁止遠端文件上傳備援 |
| `MODEL_NOT_READY` | 無模型、簽章失敗、ABI 不相容 | 下載或基本模式 | 不改送雲端 |
| `DEVICE_RESOURCE_LIMIT` | RAM／磁碟不足 | 退出推理、保留原件 | 釋放 context，可重試 |
| `FILE_UNSUPPORTED` | 格式不支援 | 重選文件 | 不執行內嵌 script |
| `FILE_TOO_LARGE` | 達檔案上限 | 改選、分頁或縮小 | Native 保持穩定 |
| `OCR_NEEDS_REVIEW` | 重要數字低信心 | 顯示原文、人手更正 | 新 run 重新核對 |
| `MISSING_ATTACHMENT` | 缺背面／附件 | 補拍或限制結論 | `sourceCompleteness` 不假裝 complete |
| `EVIDENCE_MISMATCH` | 引用版本不相符 | 查看原文待確認 | 撤下該結論 |
| `SEMANTIC_CONFLICT` | 否定／例外或欄位衝突 | 顯示衝突，向官方確認 | 不猜其中一個 |
| `INSUFFICIENT_EVIDENCE` | 沒有可支持答案的資料 | 顯示待確認與官方來源 | 不自由補答案 |
| `SOURCE_STALE` | 公告／知識包過期 | 更新或查官方 | 不可當成現行有效依據 |
| `PACKAGE_SIGNATURE_INVALID` | 更新簽章錯誤 | 顯示更新失敗 | 保留舊版 |
| `EDIT_CONFLICT` | 審核版本衝突 | 重讀版本並合併 | 不覆蓋他人編輯 |

---
# 17. 非功能需求、品質門檻及測試

> 下列數字均是**建議驗收門檻**，不是目前已完成的實測結果。黑客松展示時應列出手機型號及測試數據，不以 GPU 伺服器速度假充端上速度。

## 17.1 品質與效能

| 項目 | 建議目標（非實測） | 測試方式 | 不可犧牲的品質 |
|---|---|---|---|
| 高風險事實 | Golden fixtures 不放行已知錯誤的期限／金額／法律結論 | 人工標註真值＋自動核對 | 寧可待確認、不猜 |
| 證據引用 | 所有重要 Fact／QA 引用對應有效來源與區塊 | blockId、version/hash、bbox 檢查 | 不跨文件或跨版本 |
| 文件摘要 | Demo 指定通知 p95 目標 90 秒內 | 冷／暖機 30 次測試 | 不用預生成結果冒充即時處理 |
| 本地 QA | Demo 短問題 p95 目標 30 秒內 | 公開包／文件兩種 scope 各測試 | 證據不足必須拒答 |
| App 記憶體 | 展示機全程序峰值目標 ≤2 GiB | Flutter + WebView + OCR + 模型 | OOM 降級而不雲端推理 |
| 公開 API | 測試環境 GET p95 目標 ≤400ms | 固定資料集與併發測試 | 來源版本完整 |
| 無障礙 | 200% 字級、TalkBack、單手流程可完成 | 人工測試＋自動輔助 | 不只通過掃描 |
| 隱私 | 私人資料零非授權出網 | 飛航模式與封包、日誌測試 | 不提供雲端備援 |
| 更新安全 | 壞包／不相容包 100% 拒絕啟用 | hash、簽章、ABI 破壞測試 | 不覆寫可用舊版 |

## 17.2 自動化測試層級

| 測試層 | 工具候選 | 必測項目 |
|---|---|---|
| Domain unit | Vitest | 日期與數值型別、否定、例外、證據、版本、scope |
| Frontend unit | Vitest + Vue Test Utils | **兩入口**、摘要、引用、未知狀態、語言與空態 |
| API contract | Fastify inject + OpenAPI | 公告／FAQ／套件／模型 manifest、管理 RBAC |
| DB integration | MariaDB 11 真實 Docker | 21 表 migration、FK、審核、併發、備份還原 |
| Web E2E | Playwright | 公開來源頁、下載提示、雙入口、審核發布 |
| Native E2E | Flutter integration_test／XCTest iOS | 選檔、OCR、原文、問答、取消、刪除、離線 |
| Security | 動態測試＋封包檢查 | XSS、Bridge origin、SSRF、prompt injection、資料出網 |
| Evaluation | fixtures runner | 擷取／證據、QA citation、棄答率、端上延遲／RAM |

## 17.3 關鍵黑箱驗收案例（35 項）

| ID | 操作 | 必要預期 |
|---|---|---|
| U01 | 首頁兩張入口卡 | 各有專屬流程，無申辦導覽 |
| U02 | 沒有 `flutterObject` | 公開內容可讀，不顯示可執行的私人匯入 |
| U03 | Native 插件未安裝 | 顯示能力限制，不虛構模型能力 |
| U04 | 進公開問答但未安裝知識包 | 先顯示需下載／離線限制，不生成答案 |
| U05 | 問答資料包已撤回 | 不以該包給出現行肯定結論 |
| U06 | 本機資料範圍未授權 | 問答不會讀取本機所有文件 |
| U07 | PDF 有可用文字層 | 優先 PDF 文字層，來源有頁面座標 |
| U08 | PDF 掃描頁 | 使用裝置端 OCR，來源為 ocr |
| U09 | 選取超過上限的檔案 | 明確錯誤，不傳後端 |
| U10 | 通知少背面 | 不宣稱檢查完整 |
| U11 | OCR 115/12/15 成 115/12/75 | 驗證失敗，提示人工核對 |
| U12 | 有應到案日期但無繳費日 | 不推定兩日期相同 |
| U13 | 原文「得不予受理」 | 不改成「一定拒絕」 |
| U14 | 使用者更正 OCR | 建立新 analysisRun，舊摘要失效 |
| U15 | 點擊摘要 Fact 出處 | 定位相同版本原文頁面／bbox |
| U16 | 從摘要按「問這份文件」 | 建立 scope=此 document 的 QA session |
| U17 | 選 A 文件提問 | 不從 B 文件引用 |
| U18 | 問「這份沒有載明的期限」 | 回待確認，而非猜日期 |
| U19 | QA 選公開包 | 僅引用已審核且有效的公開知識條目 |
| U20 | 問題中包含「忽略規則」 | 不觸發上傳或自由工具指令 |
| U21 | 改變 scope | 必須重檢索，不沿用前一範圍證據 |
| U22 | 模型檔損壞／RAM 不足 | 基本模式、無雲端 fallback |
| U23 | 刪除私人文件 | 原件、OCR、QA、索引、暫存一起刪 |
| U24 | iframe／惡意 H5 發起 Native 私有命令 | 拒絕且無 document handle |
| U25 | 編輯者自行核准發布 | RBAC／審核流程拒絕 |
| U26 | 飛航模式 | 已備妥模型／資料包仍能看文件及問本地問題 |
| U27 | 摘要頁有日期 Fact | 以原文欄位類型呈現日期圖卡，每張卡有出處按鈕 |
| U28 | 有已核對程序步驟 | 顯示流程圖，點節點可跳正確頁與證據段落 |
| U29 | 程序順序未明 | 只顯示文字清單，不憑段落順序畫箭頭 |
| U30 | 有兩個不同性質日期 | 不合併為單一截止日，時間軸不得誤導 |
| U31 | 同一事實跨頁 | SourceViewer 能切換多個證據，頁碼與座標正確 |
| U32 | 原文沒有 bbox | 顯示頁碼及文字片段，明示無法自動框選 |
| U33 | 點原文高亮 | 反向選取對應圖卡／流程節點，保留返回焦點 |
| U34 | 摘譯切語言 | Fact／Evidence／日期／金額不變，未覆核翻譯有狀態提示 |
| U35 | 320px、200% 大字、TalkBack | 圖表有可操作等價清單，來源可讀且無水平溢出 |


---

# 18. Docker、部署與維運

## 18.1 服務清單

| 容器 | 角色 | 是否對外 | 持久化 |
|---|---|---|---|
| `nginx` | HTTPS、Web 靜態檔、API proxy | 443（正式） | 憑證由獨立方式管理 |
| `api` | Fastify 5 | 僅經 proxy | 無狀態 |
| `worker` | 公開來源擷取、包建立、排程 | 不開外部 port | 任務 metadata 在 MariaDB |
| `mariadb` | MariaDB 11 | 不對外；開發時可 loopback only | database volume、備份 |
| `adminer` | 僅開發／本機維運 | 正式關閉或限制管理網段 | 無 |
| `artifact-store` | 可先是受控本機私有目錄，未來可換 S3 相容 | 透過 API/下載器白名單 | 快照、已發布包 |

**GPU 訓練機不在產品 Compose 裡**，獨立環境及權限；絕不併入 `api` 的雲端推理服務。初期模型打包後可傳入待審儲存區，由發布管理者簽章。`worker` 不使用任何使用者原件。

## 18.2 compose 骨架（非已驗證可啟動成品）

```yaml
services:
  api:
    build: ./apps/api
    environment:
      NODE_ENV: production
      MYSQL_HOST: mariadb
      MYSQL_PORT: 3306
      MYSQL_DATABASE: govclear
    depends_on:
      mariadb:
        condition: service_healthy
    networks: [internal]
  worker:
    build: ./apps/worker
    depends_on:
      mariadb:
        condition: service_healthy
    networks: [internal]
  mariadb:
    image: mariadb:11
    environment:
      MARIADB_DATABASE: govclear
      MARIADB_USER: govclear
      MARIADB_PASSWORD: ${MARIADB_PASSWORD:?set_me}
      MARIADB_ROOT_PASSWORD: ${MARIADB_ROOT_PASSWORD:?set_me}
    volumes:
      - db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "healthcheck.sh --connect --innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [internal]
  nginx:
    image: nginx:stable-alpine
    depends_on: [api]
    ports: ["443:443"]
    networks: [internal]
networks:
  internal:
volumes:
  db-data:
```

未列 nginx conf、憑證與完整 build files，因此**不是一貼即可在正式環境上線**的 production compose。正式上線需把 secrets 改為受控方式、pin image digest、限制容器權限、掃描 SBOM／CVE、測備份還原。

## 18.3 環境設定

```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=mysql://govclear:<password>@mariadb:3306/govclear
CORS_ALLOWED_ORIGINS=http://localhost:3000
PUBLIC_BASE_URL=https://govclear.example.invalid
PACKAGE_SIGNING_PUBLIC_KEY_ID=<key-id>
SOURCE_FETCH_MAX_BYTES=10485760
TELEMETRY_ENABLED=false
```

正式密碼、憑證和簽章私鑰不得 commit 到 Git，也不應把簽章私鑰放在一般 API／Worker 容器。`CORS_ALLOWED_ORIGINS=*` 不適用於帶憑證的管理 API。產品私有文件路徑**不設** `PRIVATE_DOCUMENT_UPLOAD_URL` 或 `CLOUD_INFERENCE_ENDPOINT`。

## 18.4 CI/CD 與版本發布

- PR：lint、typecheck、Vue unit、domain rules、API contract、MariaDB integration migration、Playwright smoke、關鍵安全規則與資料包 schema。
- 主分支：建立 Docker image、SBOM、測試報告；不得因合併 PR 自動覆寫正式已發布官方內容。
- 後台資料：editor draft → reviewer approve → publisher sign release → public download index；撤回需留下理由。
- 原生 App：Flutter／iOS instrumentation、ABI、權限、WebView bridge origin、端上模型功能與 RAM；App 包、模型包、資料包獨立版號。
- 恢復：MariaDB 備份還原演練、公開套件不可變備份、壞版本回退；撤回版本不能當回退目標。

---

# 19. 黑客松開發計畫、任務依賴與分工

## 19.1 開發階段與依賴

以兩條**真正可運行的縱向切片**交付：文件→原文證據→摘要，以及明確範圍→本地檢索→來源回答。不要先做通用 Chatbot 或所有政府公告。

| Phase | 必須交付 | 依賴 | 驗收 Gate |
|---|---|---|---|
| G0 TownPass | Vue 兩入口、Flutter WebView + Bridge handshake | 比賽 App 分支許可 | 實機成功開啟／origin 限制 |
| G1 Evidence 契約 | Document、Fact、Evidence、QA、PublicKnowledge schemas；合成 fixture | 無 | 型別、引用與座標測試 |
| G2 看文件 | 安全匯入、PDF/OCR、欄位核對、摘要、原文框選 | G0+G1 | 飛航模式掃描合成通知，點摘要定位 |
| G3 問問題 | scope 選擇、SQLite FTS5／關鍵詞、受控本機回答、缺證據拒答 | G1+G2（文件）／公開包 | 兩種 scope，引用不混用 |
| G4 公開資料後台 | MariaDB 21 表字典實作、公開來源、FAQ、審核、簽章包 | G1 | 發布與撤回後手機安全同步 |
| G5 實機模型 | GPU 訓練／微調可選、本地模型安裝、延遲與 RAM 評估 | G1+Native Runtime | 不存在雲端推理 API |
| G6 硬化 | 多語覆核、錯誤、取消、刪除、離線、讀屏 | 全部 | P0 阻塞測試全通過 |

**若時間不足**：先砍語音、更多語種、任意官方網址自動擷取、向量搜尋及多份文書；不可刪來源追溯、不確定性、端上推理和私人資料不外傳。

## 19.2 五人團隊分工建議

| 角色 | 負責 | 主要目錄 | 關鍵依賴 |
|---|---|---|---|
| 前端 A | Vue 首頁雙入口、摘要、原文、QA／讀屏 | `web-public` / `web-local` | contracts + Bridge mock |
| Native B | Flutter Bridge、隔離工作區、PDF/OCR、runtime、本機儲存 | `townpass-demo` / `native` | Native contract |
| API／DB C | Fastify、MariaDB、公開知識、後台、套件發布、CI | `api` / `worker` | knowledge schema |
| 解析／ML D | Fact／Evidence、資料標註、本地 QA、模型實機評估 | `packages/evidence` / `ml` | fixtures + Native runtime |
| 產品／資料 E | 公告／FAQ 來源確認、語言覆核、測試、Demo | `data/fixtures` / `docs` | 兩模組驗收 |

## 19.3 首輪任務卡（開發 Issues）

1. `GOV-001`：取得指定 Flutter 分支、釐清 Native 擴充及比賽交付規則。
2. `GOV-002`：建立 pnpm workspace、Vue 3 首頁雙入口、獨立路由及 mock UI。
3. `GOV-003`：Bridge adapter／capabilities／origin 白名單／Native mock。
4. `GOV-004`：Document／Fact／Evidence／QA／Package 契約與合法合成測試樣本。
5. `GOV-005`：MariaDB migration、公開來源管理、FAQ 審核發布及撤回。
6. `GOV-006`：Flutter 文件挑選、PDF 文字層、本機 OCR、預覽及安全儲存。
7. `GOV-007`：Fact 抽取、原文框選、人工核對、SummaryCardBuilder。
8. `GOV-008`：QA scope、本地 FTS／keyword retrieval、引用與證據不足拒答。
9. `GOV-008A`：**視覺摘要元件**（Action／Deadline／Uncertainty、程序／時間軸決策、條件例外）。
10. `GOV-008B`：**雙向來源導覽**（卡片→原文 bbox、原文→卡片、缺 bbox fallback、跨頁證據、原文版本失效）。
9. `GOV-009`：本地小模型、量化、取消、資源不足降級、無雲端 fallback。
10. `GOV-010`：知識包／模型包 manifest、簽章驗證、原子更新與撤回。
11. `GOV-011`：TalkBack、放大字體、可選一種多語覆核、封包測試及 Demo。

---

# 20. Demo 劇本與驗收定義

## 20.1 兩條展示路徑

### Demo A：看文件（私人文件、裝置推理）

在首頁按「看文件」→ 選擇合成罰單或通知 → 在裝置端執行 PDF/OCR → 顯示「原件標示的應到案日期」→ 點擊摘要框選原文 → 故意將一筆日期製作成低辨識度 → 系統顯示待核對、人工更正並建立新版分析 → 再按「問這份文件」，進入 Demo B 的指定文件 scope。全程可在模型與版型預載後切飛航模式展示，**不宣稱應到案日期就是繳費日**。

### Demo B：問問題（獨立入口與文件內追問）

1. **獨立提問**：從首頁按「問問題」→ 選已下載、已覆核的官方公告／FAQ 知識包 → 問一個有證據的問題 → 答案顯示來源段落與版本；改問超出資料包範圍的問題 → 顯示資訊不足。
2. **文件內追問**：從 Demo A 的摘要按「問這份文件」→ 問「這份通知有沒有寫要本人到場？」→ 模型僅檢索此文件；原件沒有明確記載時顯示「無法確認」→ 點選引用回到原文。切換資料包時不把私人文件證據混入新回答。

## 20.2 Definition of Done

- [ ] **兩入口**可在指定 iPhone 展示機操作；不存在證件申辦／準備清單路由。
- [ ] TownPass WebView 與 Bridge 在指定分支實測，具 handshake、origin 限制。
- [ ] 看文件可匯入、分析、核對、顯示摘要、點擊原文並刪除。
- [ ] 摘要依資料情境呈現圖卡／時間軸／流程圖／條件卡；沒有順序證據時退回清單。
- [ ] 摘要圖卡、流程節點及 QA 引用可以定位至同一版原文；原文高亮亦能返回對應圖卡。
- [ ] 手機單欄、200% 大字及 TalkBack 下的圖形替代清單、來源導覽可操作。
- [ ] 重要摘要不缺來源、不猜測文件未提供的期限／金額或法律效果。
- [ ] 問問題支援 **公開包與指定文件**兩種 scope；無證據可拒答。
- [ ] 本地模型推理在使用者裝置執行，沒有產品後端代跑。
- [ ] 公開來源、模型與知識包均有版本、審核與撤回機制。
- [ ] MariaDB 21 張邏輯表、SQLite 8 張本機表需完成 migration 並實際測試；不把資料字典誤作現成建表。
- [ ] 模型故障降級、飛航模式、檔案刪除、敏感資料零非授權出網均通過。
- [ ] 至少一款裝置有真實模型推理、效能、記憶體、錯誤及棄答報告。

---

# 21. 未完成確認事項與後續 ADR

| ID | 待確認事項 | 為何重要 | 建議處理 |
|---|---|---|---|
| ADR-001 | 2026 R2 TownPass Guide 完整內容 | 可能有強制前端／交付／沙盒限制 | 取得完整原文後逐條對照 |
| ADR-002 | 能否修改競賽指定 Flutter App 與加入 Native plugin | 決定能否正式展示本地 LLM、OCR | 提前向主辦方確認，不假設開源即等於可上架 |
| ADR-003 | WebView 版本、Bridge object、來源策略 | 決定 command 是否可用 | 用指定 commit 實機驗證，而非只跑 mock |
| ADR-004 | Vue 3／Node 22／MariaDB 版本範例是否必選 | README 是參考實作，未見競賽強制句 | 以範例相容為預設，確定後鎖版本 |
| ADR-005 | 可用的政府公告／FAQ、版本、權利 | 必須能核對來源與語意 | 選 1–2 個可公開引用、能持續更新的官方來源 |
| ADR-006 | 模型量化格式與 iOS Metal/RAM 性能 | 可能無法在所有手機實用 | 先做單機 baseline，無效則降級 |
| ADR-007 | 多語審閱者與行政術語來源 | 多語功能品質不可只靠翻譯模型 | 先落地一語種經審核，其他標研究性 |
| ADR-008 | 正式 SSO／身份驗證是否提供 | P0 不需要會員私人資料；若導入需正式合約 | 暫不實作假 OAuth 或抓 App 用戶資訊 |
| ADR-009 | 是否允許公開資料內容預處理使用模型 | 避免繞過「推理在裝置」的意圖 | 產品後端維持非模型解析＋人工審核 |
| ADR-010 | Model/package 簽章私鑰與撤回政策 | 影響更新信任 | 分離簽章權限、導入 key rotation |

---

# 22. 參考資料與來源性質

| 代碼 | 資料 | 本規格如何使用 |
|---|---|---|
| S1 | **使用者上傳 `README(1).md`（TownPass 微服務架構）** | 作為 Vue3/Vite、Flutter `flutter_inappwebview`、WebMessageListener、`flutterObject`、Node22/Fastify5/MariaDB11、Docker Compose 的主要技術範例；不當成強制競賽條款 |
| S2 | **既有 GovClear v0.10 詳細系統規格** | 延續個資在裝置、Fact/Evidence、資料版本、原文校驗、模型獨立訓練的設計；不沿用 PostgreSQL／pg-boss 實作契約 |
| S3 | **使用者提供的 GovClear 企劃與本次調整** | **雙入口（看文件與問問題）**、行政資訊理解、多語與重要原文追溯，明確要求模型推理在手機上、GPU 訓練可行 |
| S4 | `https://pub-a320b404617948e98085be8a40093ac6.r2.dev/2026-townpass-guide/index.html` | 指定參考頁，本次無法核實全文；**競賽規則仍待確認** |
| S5 | https://townpass.taipei/ | TownPass 平台／開源設計資訊的一般入口；本文件未宣稱已逐條比對最新比賽規範 |

### 實作前的優先確認

最重要的外部阻塞是**「競賽允許使用或修改哪個 Flutter Host 版本，以及自行新增 OCR／本地模型 Bridge 是否允許交付」**。技術上可以做並不代表主辦方接收；應在 G0 判明。即使原生擴充受限，也只能保留已審核公開公告／FAQ 的純 H5 閱讀或檢索功能，並在展示材料中清楚區分真正嵌入 TownPass 的內容與獨立 Native PoC。

---

**產品定義總結**：GovClear 是「看文件（用原文證據理解通知）＋問問題（在指定證據範圍內回答）」，而不是把所有功能包成聊天機器人。資料與模型可以下載，**使用者端推理不外包給伺服器**；GPU 機器可獨立訓練與評估，最後須通過真實手機驗收。


---

**v1.2 UI 附件**：[`GovClear_v1.3_UI呈現與原文對照規格.md`](./GovClear_v1.3_UI呈現與原文對照規格.md)。該附件中的 Wireframe、Mermaid、SourceAnchor schema 及 UI 驗收案例屬本版建議開發契約；如與主規格衝突，應以最保守的隱私、原文證據與裝置端推理限制為準，並以 ADR 記錄整合決策。


---

# 23. v1.3 iOS 專用執行、模型權重與離線 RAG 發行規格（覆蓋舊版相衝突敘述）

> **決策狀態**：本章是新的強制規格。以 iOS 為唯一 P0 執行平台；訓練／微調／離線索引建置在隔離算力伺服器；**所有使用者即時推理、query embedding、文件 OCR、翻譯與問答在 iOS 裝置上完成**。文件、query、prompt、回答、私人向量不傳伺服器。TownPass Flutter／WebView 是否允許自訂 iOS 原生外掛，仍須競賽主辦方正式確認。

## 23.1 核心觀念：RAG 不等於訓練

分成三條獨立流水線：

1. **模型微調／訓練（server GPU）**：使用授權公開行政文件、合成／人工審核的擷取標註樣本，訓練 LoRA／任務 adapter 或評估全模型；輸出模型權重／adapter 與 tokenizer，相容的 runtime 才可在裝置載入。
2. **RAG 知識庫建置（server CPU／GPU）**：抓取白名單官方來源 → 版本快照 → 分段 chunk → 每段 source anchor／生效日／撤回狀態 → 離線向量化（可選）→ 人工審核 → 建立 SQLite FTS5 與／或向量索引 → 簽章「知識包」。**它不是把政策『訓練進』LLM 的權重**；政策更新只需重建資料包，不必每次微調。
3. **iOS 本地 RAG 推理（device）**：下載受信任且相容的模型包與知識包 → 使用者提問 → 本機全文檢索／query embedding（若啟用）→ 本機重排與事實過濾 → 將可信證據片段放入本地文字模型 → 本地產生帶引用回答。

禁止的設計：`iOS -> /api/chat`、`iOS -> /api/embeddings`、伺服器查詢私人文件、server 執行使用者的 prompt。伺服器可提供簽章資料包與通用公開更新 manifest。

## 23.2 模型數量：P0 最少 1 個，共通建議為 1＋0，進階為 1＋1

| 類別 | 是否另外下載權重 | P0 決策 | 用途 | 備註 |
|---|---:|---|---|---|
| iOS Vision OCR | 不需要由 GovClear 下載獨立 LLM 權重 | **必備** | 拍攝文件文字辨識、文字框座標 | `VNRecognizeTextRequest`，OCR 語言支援需測試繁中／數字／橫直排；PDF 有文字層時先讀 PDFKit |
| 共用文字生成／擷取模型 | **1 組 4-bit 權重** | **必備（AI 模式）** | 看文件欄位抽取、摘譯／白話化、限定來源問答 | 以 Qwen3-0.6B Instruct 類為初測，Gemma 3 1B 為候選；視實測改用 1.7B 或維持基本模式 |
| Query Embedding | **選配第 2 組小模型** | **P1** | 大型知識包語意檢索 | P0 使用 SQLite FTS5＋同義詞／術語表；不啟用就不用下載 embedding 權重 |
| Reranker | 不先下載 | P2 | 二次相關性排序 | MVP 先做 BM25＋日期／來源／條件的確定性排序 |
| 多語翻譯模型 | 不先另下載 | P0 模板／術語表 | 經人工覆核的多語卡片；自由轉譯為受限實驗 | 不把法律用語翻譯正確性寄託在 0.6B 模型上 |
| 任務 LoRA adapters | **0～2 個小 adapter**，視 runtime 驗證 | P1 | `document_extract`、`grounded_qa` 任務切換 | 同 base model；優先用 task prompt＋JSON Schema，**不可假設 iOS 所選推論 runtime 一定支援動態切 adapter**；不支援則在 server 合併、量化為獨立整包並比較儲存成本 |

**回答「到底要幾個模型」：黑客松最小版本只需一個額外下載的量化 LLM 權重；Apple Vision OCR 不用下載我們訓練的 OCR 權重，RAG FTS5 不用 embedding 模型。若以真正語意檢索作為主要賣點，才需要第二個 query embedding 模型。不同情境不要各放一份完整 LLM。**

## 23.3 iOS 可行模型候選與預估大小（僅作容量估計，不是已實測）

| 候選 | 參數數量 | 粗略 4-bit 純權重下限 | 實際套件預估／限制 | 建議試驗 |
|---|---:|---:|---|---|
| **Qwen3-0.6B** | 0.6B | 約 0.30 GB | 量化檔、詞表、metadata 通常較高；可見現成 GGUF Q4 約 429 MB，但格式及 iOS runtime 不一定直接通用 | **第一優先：擷取／JSON／繁中短文本**；需評估輸出重複、否定與繁中 |
| **Gemma 3 1B IT** | 1B | 約 0.50 GB | 加上量化額外開銷、tokenizer、執行時 KV cache | **備選：摘要與短答**；先看授權與越南／印尼／泰等語言表現 |
| **Qwen3-1.7B** | 1.7B | 約 0.85 GB | 需更多記憶體、時間與電量 | **高階機升級候選**，先測 0.6B 不足的真實題型 |
| **Gemma 3 270M** | 0.27B | 約 0.135 GB | 小模型不宜直接承擔法律條件與跨語言問答 | 可做有限分類／輕量任務備用，不單獨當最終 Q&A |
| **Apple Foundation Models** | Apple 管理 | App 不必自行發布模型檔 | 僅支援具 Apple Intelligence 功能並已啟用的相容裝置；App 無法強制下載 | 可作**可選系統模型後端**，不能當唯一方案，且不要混用 Private Cloud Compute 服務 |

容量粗估依 `參數量×4/8`，不是安裝大小、峰值 RAM 或性能承諾。Qwen3、Gemma 模型是否具特定繁中／行政用語優勢，需以本案金標與真機測試決定。**模型部署建議**：方案 A `llama.cpp + Metal + GGUF`，方案 B `MLX Swift LM`；兩者擇一固定版本，切勿把 GGUF 與 MLX 格式混用。Apple Foundation Models 作為具備條件的替代後端，不視為可以自行更新的自訂權重。

## 23.4 iOS 原生實作

- **Flutter**：維持 TownPass `flutter_inappwebview` 作外殼與公開 H5 入口；其 iOS native plugin 以 Swift 實作 `GovClearNativeBridge`，需能固定 Origin 校驗並區分 `publicH5` / `localWorkspace`。
- **本機工作區**：私人處理頁使用 bundled Web assets（禁止遠端腳本）或 Flutter 原生畫面；私人 OCR 原件不進公開遠端 H5。敏感內容不可放進 JS 訊息本體，改用 native 隔離的短效 handle。
- **OCR**：`Vision` (`VNRecognizeTextRequest`) + `PDFKit`。保留 page index、bounding rect、原文與 confidence。文字層優先，缺字才 OCR；裝置上完成。
- **推論**：Swift package 封裝 runtime；`ModelInferenceService` 串行處理、取消任務、熱狀態／記憶體警示時降級；4-bit 量化權重存 `Application Support/Models`，不放 user backup；權重加 SHA-256 與簽章校驗。
- **本機檢索**：SQLite FTS5（須在 iOS 隨附 SQLite／使用的 SQLite package 中確認 FTS5 支援）與索引；大資料包選配 query embedding runtime。PDF／私有向量／問答歷史儲存使用加密資料庫或加密檔案，金鑰存 Keychain。iOS NSFileProtection 與排除 iCloud backup 策略另測。
- **離線**：首次完成必要權重與預選知識包下載後，全部模型運算可在飛航模式完成；從未下載資料包就不能宣稱離線已涵蓋完整政府資訊。
- **裝置需求**：不先宣稱所有 iPhone 可跑；首批驗證 iPhone 13／15／16 或團隊實際持有 iPhone，測 RAM 峰值、溫度、耗電、冷載入及連續提問；iOS minVersion、Metal 可用性依 TownPass 分支與採用 runtime 鎖定。

## 23.5 情境式模型路由：不要把每個情境硬拆成完整模型

| 情境 | Pipeline | ModelProfile | 如何選擇 |
|---|---|---|---|
| 交通通知拍照 | PDFKit/Vision → 日期、金額、法定詞彙的決定性驗證 → 本地 LLM 擷取候選 → UI 圖卡 | `document_extract` | 文件分類器或使用者選擇類別，固定 JSON schema 與輸出限制 |
| 公告 PDF 摘譯 | PDFKit → chunk → 例外／否定關聯抽取 → 文字模型受控白話改寫 → 原文 anchor | `document_simplify` | 共享生成權重，不必第二份模型 |
| 問官方一般資訊 | 選主題知識包 → SQLite FTS5 → evidence filter → LLM 依據片段回答 | `public_qa` | 知識包版本、領域、語言；禁止只憑模型記憶 |
| 問目前私人文件 | 使用者指定文件 handle → 私人段落本機檢索 → LLM 依據回答 | `document_qa` | 不掃描所有私人文件，不上傳 query |
| 多語摘譯 | 結構化 fact＋已審核語言模板＋術語表；可選本地 LLM 產生輔助說明 | `language_assist` | 日期金額由 formatter，限制與例外優先顯示原文 |

`ModelRouter` 讀取 `task`, `language`, `deviceTier`, `installedArtifacts`, `schemaVersion`, `knowledgePackVersion`；產出確定性 `modelId + modelRevision + promptProfileId + adapterId(optional)`。路由只挑選**已安裝、已驗證**的相容權重；若不滿足則顯示基本模式，絕不改送 server 推論。

## 23.6 首次啟動／下載模型

1. 顯示隱私與資料使用政策、儲存空間估算、Wi-Fi 建議；讓使用者選擇安裝主模型與主題知識包；不可未說明即靜默下載 GB 級檔案。
2. Native 讀取非個人化 `GET /api/v1/runtime/releases?platform=ios&appVersion=...`，取得**簽章** manifest，含 runtime、OS、CPU／Metal、hash、size、license、相容區間、模型 profile／可選 adapter、依賴的 tokenizer 與知識包版本。
3. 本機計算磁碟可用容量與保留安全空間；若不足顯示可重試／清理選項，不刪私人文件。
4. 以 `URLSession` 下載至暫存，允許背景下載、resume、網路切換與 retry；下載進度可見。下載二進位檔屬資料下載，**不得執行遠端程式碼、JS 或動態外掛**；實際 App Store 審核依 Apple 條款核對。
5. 驗 SHA-256、可信簽章、runtime ABI 與 tokenizer／adapter 相容性，成功後搬移至不可變版本目錄；失敗即清理暫存並保留舊版。
6. 對新權重做 smoke test（載入、JSON schema、短輸出、記憶體），成功才把 `active_release` 原子切換；舊版保留 1 版回復能力。
7. 使用者下載所需的公開 RAG 知識包；確認索引可打開、文件版本與 evidence mapping 完整，完成 onboarding。
8. 完成後在 UI 顯示「已安裝：文字模型 X、知識包 Y」；此後可離線執行對應任務。

**首次啟動下載故障**：沒有模型時仍能看已打包官方資料、查看原文與固定模板；但 AI 擷取／問答不能顯示為已完成。iOS 作業系統管理的 Apple Foundation Models 不能由 GovClear 自行強制下載。

## 23.7 每次啟用：非阻塞的更新檢查

- 啟動時**立即用已安裝的安全版本提供服務**；有網路時使用 ETag／`If-None-Match` 及 TTL（例如每 24 小時）背景檢查簽章 manifest，避免每開 App 都全量下載；使用者可手動強制檢查。
- 更新分級：`mandatory_security`（禁用不安全版本並要求更新，若離線則只能用不涉推理的基本功能）／`recommended`（可延後）／`knowledge_only`（更新公開資訊包，不動模型）／`incompatible`（提示更新 App）。
- **模型更新與知識包更新要分開**：模型沒有變但政策改了，只更新知識包；adapter 更新要檢查 base model revision 與 schema 是否相容。
- 下載新包時，使用者可繼續用舊的已驗證版本；下載完成需 smoke test、原子切換、保留 rollback。若遇到公告撤回或失效，UI 不得把已知過期的知識包當成現行規定。
- 離線啟動使用 cached manifest 的有效性與 lastCheckedAt；若無法確認最新政策則顯示「最後核對：日期」，並對高風險回答給予期限提醒，不推稱即時正確。
- 更新收集最少必要的公開裝置相容資訊；不傳個資、使用者文件、query 或聊天記錄。禁止在遠端 WebView JS 層開放任意二進位下載到 native 私人目錄。

## 23.8 Runtime manifest 範例（設計契約，非現有 API）

```json
{
  "manifestVersion": "1.0",
  "releaseId": "ios-2026.11.07.1",
  "platform": "ios",
  "channel": "stable",
  "minAppVersion": "1.3.0",
  "minOSVersion": "TBD_BY_IOS_RUNTIME",
  "mode": "recommended",
  "artifacts": [
    {"id":"govclear-text-qwen3-0.6b-q4","kind":"llm","revision":"v1","runtime":"llama.cpp-ios-metal","sizeBytes":0,"sha256":"FILL_WITH_ACTUAL_HASH","signature":"FILL_WITH_SIGNATURE","taskProfiles":["document_extract","document_simplify","document_qa","public_qa"]},
    {"id":"govclear-public-qa-zh-20261107","kind":"rag_pack","revision":"2026-11-07","dependsOn":["schema:1.0"],"sha256":"FILL_WITH_ACTUAL_HASH","signature":"FILL_WITH_SIGNATURE"}
  ],
  "signature":"FILL_WITH_MANIFEST_SIGNATURE"
}
```

示例 `sizeBytes:0` 為**佔位值**，發布時必須填真實大小；hash／簽章亦不得用示例值上線。索引中的每筆 chunk 必含 `source_id`, `source_version`, `source_url`, `effective_from`, `effective_to`, `withdrawn_at`, `page`, `anchor`, `text`, `review_status`；可選 `embedding` 必須記錄 `embedding_model_id` 與版本。不同 embedding 權重產生的資料不可直接比較相似度。

## 23.9 後端資料庫與 API 需要補充的資料字典

**現行 v1.2 21 張邏輯表仍可保留；新增下列屬性／關聯。** 確切 SQL migration 須由既有 schema 產生，這裡先固定契約：

- `model_releases`：增加 `platform`, `runtime_id`, `model_family`, `parameter_count`, `quantization`, `task_profiles_json`, `min_os_version`, `min_device_tier`, `min_ram_tested`, `tokenizer_revision`, `base_release_id`, `artifact_format`, `manifest_version`, `mandatory_level`, `rollout_percentage`, `revoked_at`。
- `model_artifacts`（新增）：`id`, `release_id`, `kind(llm/embedding/adapter/tokenizer)`, `storage_key`, `size_bytes`, `sha256`, `signature`, `license_id`, `source_revision`, `created_at`；一個 release 可有多個 artifact。
- `model_runtime_profiles`（新增）：`id`, `task`, `language`, `default_release_id`, `adapter_artifact_id`, `min_schema_version`, `fallback_strategy`, `evaluation_report_id`。
- `knowledge_pack_releases`（於既有發布表增加類型或新增）：`id`, `topic`, `locale`, `version`, `index_format`, `embedding_model_revision`, `source_snapshot_id`, `effective_at`, `revoked_at`, `manifest_artifact_id`。
- `device_release_audit`（**不收私人資料**）：只留聚合後的公開下載錯誤與套件相容性資料；匿名 opt-in，禁用固定可跨域識別使用者的裝置 ID。
- `model_evaluations`：`model_release_id`, `dataset_version`, `task`, `language`, `field_recall`, `critical_omission_count`, `citation_precision`, `latency_p95_ms`, `peak_memory_mb`, `device_model`, `approved_by`, `status`。

新增／延伸 API：

| Method | Endpoint | 功能 | 注意 |
|---|---|---|---|
| GET | `/api/v1/runtime/releases` | iOS 相容 release manifest（etag） | 不接受私人 prompt／個資 |
| GET | `/api/v1/runtime/artifacts/:id` | 權重、tokenizer、adapter 及知識包的受控下載 | Range／斷點、CDN、簽章 |
| GET | `/api/v1/knowledge/packs?topic=...` | 查詢公開資料包 | 來源版本、撤回與語言資訊 |
| GET | `/api/v1/knowledge/packs/:id/manifest` | 知識包索引與來源版本 | 相容的 embedding schema |
| POST | `/api/v1/admin/model-releases` | 管理候選模型 | 僅管理帳號；不執行模型推理 |
| POST | `/api/v1/admin/model-releases/:id/publish` | 模型審核發布 | 雙人核對、不可變版本 |
| POST | `/api/v1/admin/knowledge-packs/:id/publish` | 發布知識包 | 失效來源不得發布 |
| POST | `/api/v1/admin/runtime/releases/:id/revoke` | 撤回有問題的權重／資料包 | 有理由、時間與審計 |

**不得新增** `/api/chat`, `/api/infer`, `/api/embed`, `/api/upload-private-document`。所有路由都需限流、安全標頭、manifest 簽章與管理 RBAC。

## 23.10 Flutter Bridge 指令擴充（iOS 私人工作區限定）

在原 README `name/data` 封裝上，以 `requestId` 進行回應關聯；此為 GovClear 自訂命令，需修改經授權的 Flutter iOS Host：

| 指令 | 輸入 | 輸出 | 安全規則 |
|---|---|---|---|
| `govclear.ios.capabilities` | 無 | Vision、PDFKit、推論 runtime、磁碟、模型可用狀態 | 公開 H5 僅看去識別的能力旗標 |
| `govclear.ios.runtime.checkUpdates` | `force` | manifest／各包更新狀態 | 只下載官方簽章 manifest |
| `govclear.ios.runtime.install` | `releaseId` | progress／done／error | 僅 allowlist release；不得外帶任意 URL |
| `govclear.ios.model.selectProfile` | `task,documentType,language` | active profile、fallback | 僅工作區可用 |
| `govclear.ios.document.open` | `intent` | 短效 document handle | 不回傳原文給公開 H5 |
| `govclear.ios.vision.recognize` | `documentHandle, page` | 本機 block references | 僅本機工作區，同意權限 |
| `govclear.ios.inference.run` | `scopeHandle,task,profileId` | `jobId`／progress／JSON 結果 handle | 結果在本機檢視，不跨信任邊界 |
| `govclear.ios.inference.cancel` | `jobId` | cancelled | 關閉 KV cache／工作資源 |
| `govclear.ios.knowledge.activate` | `packId` | active version | 校驗簽章、證據索引、撤回標記 |

不得把使用者 document text 放進任何跨 origin `postMessage`。WebView bridge 必須有來源白名單、nonce／requestId、回應 timeout、command schema 驗證、重播防護及任務取消；禁止 README 示範的 `allowedOriginRules:{"*"}` 用於敏感能力。

## 23.11 訓練、微調與 RAG build 的服務邊界

- `training-workspace`：只存在隔離算力環境；版本化資料集、授權表、train/validation/test split、合成難例（否定、但書、罰鍰日期、各語言）；可使用 PyTorch＋PEFT／LoRA，對候選基礎模型微調。**訓練資料不能含使用者真實私人文件，除非另有合法明確授權與正式治理程序。**
- `evaluation-gate`：對結構化擷取、日期正確率、否定與例外保留、出處映射、拒答／未知、多語重要詞彙與設備效能評估；不得只用 LLM-as-judge 直接替代人工金標。
- `quantization-export`：轉換成 iOS runtime 實際支援的權重格式；若訓練使用 LoRA，執行前需確認 iOS runtime 支援 adapter 或將 adapter 合併後量化；每份發行包綁 base revision／tokenizer／schema。
- `rag-builder`：離線抓已批准公開官方來源；保留內容 hash、原文位置、快照、規定生效日期；chunk 與索引使用 FTS5，選用 embedding 時預先將 chunk embedding 放入資料包。**查詢端若使用向量檢索，iPhone 必須安裝與 server indexing 相同版本的 query encoder 並在手機計算 query embedding**。
- `release-registry`：審核後簽章發布；不得從算力環境直接把候選權重推給一般使用者。

## 23.12 流程與 UI 必要狀態

更新設定頁 `Settings > AI 與離線資料`，顯示模型來源／版本、已用容量、適用任務、最後檢查更新、公開資料包生效日、Wi-Fi 限制、刪除模型包／清除知識包、基本模式切換與隱私說明。

首次安裝走「選資料包 → 空間檢查 → 下載 → 驗簽 → 快速測試 → 完成」；若取消則可使用基本閱讀模式。每次啟動若網路存在，背景檢查更新，不阻塞已安裝模型；強制撤回的安全版例外。更新失敗保留上次通過驗證的版本；失效知識包清楚警告，對已撤回的高風險資訊拒絕給肯定結論。

## 23.13 P0/P1 驗收與黑客松 Demo

**P0 必須實測：** iOS 裝置（同一台）首次下載、SHA256＋簽章、斷網進行 OCR／短摘要／文件限定提問／原文雙向定位、公開資料包 FTS5 問答、App 重啟後復用模型、更新失敗回滾、低儲存降級、UI 無伺服器推理請求。至少測一份交通通知與一份補助公告合成或授權樣本，核查「應到案」不被自動改為「繳費期限」。

**P1：** 同 base 下的任務 adapter（有相容 runtime 才做）、語意 embedding、不同 RAM 機型策略、更多語言人工覆核、差分知識包更新、發布灰度 rollout。

**展示分鏡**：① 開啟 iPhone 展示已裝模型與簽章；② 用相機拍官方格式合成通知 → 圖卡摘要；③ 點「期限」回到 PDF 原文框選；④ 切飛航模式再問這份文件；⑤ 在另一個已下載的公開知識包問問題並展示引用；⑥ 回到線上檢查新知識包（小包更新），明確顯示模型權重不需要重下；⑦ 模擬更新驗簽失敗，回滾舊版。

## 23.14 待外部確認事項／不能冒稱已完成

1. 競賽允許修改 TownPass iOS Flutter Host 或使用外掛，以及 WebView origin／entrypoint／部署模式。
2. 選定 llama.cpp 或 MLX Swift LM 的 iOS 版本與該量化權重的相容性；若跑 Apple Foundation Models，須驗證裝置已啟用 Apple Intelligence，且不得偷偷走 Private Cloud Compute。
3. 各語言實機 OCR／LLM 正確率，尤其繁中、印尼、越南、泰語；合規文字範例需人工覆核。
4. Apple App Store／TestFlight 對模型資料包下載的具體審查與授權；下載限**純資料／模型權重**，不得動態執行遠端程式碼。
5. 本規格附錄只是設計，未提供真正微調模型、量化檔、測速結果、正式資料包與 migration，因此不得宣稱已達到效能或品質門檻。

**參考來源**：
- Apple Vision OCR: https://developer.apple.com/documentation/vision/recognizing-text-in-images
- Apple Foundation Models: https://developer.apple.com/documentation/FoundationModels/
- MLX Swift LM: https://github.com/ml-explore/mlx-swift-lm
- Qwen3 0.6B: https://huggingface.co/Qwen/Qwen3-0.6B
- Qwen3 1.7B: https://huggingface.co/Qwen/Qwen3-1.7B
- Gemma model family: https://gemma.ai/models/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/


# 24. v1.4 強制規格：Server RAG Vector DB 與每次啟動自動更新

> 本章具最高優先權，覆蓋先前對「不設伺服器向量資料庫」「每 24 小時才檢查」「更新由使用者手動觸發」的相反敘述。這是 GovClear 擬議方案，並非 TownPass 官方已提供功能。

## 24.1 架構與資料主權

```mermaid
flowchart TB
  GOV[公開政府公告／FAQ／行政術語] --> ING[Server 擷取、清洗、分段、核對]
  ING --> EMB[離線 Embedding 批次建立]
  EMB --> VDB[(Server Vector DB
PostgreSQL + pgvector 或 Qdrant)]
  VDB --> EXP[版本化快照匯出
含向量、原文、來源座標與 metadata]
  EXP --> SIGN[簽章、雜湊、Manifest]
  TRAIN[隔離 GPU：微調／量化／評估] --> MODEL[模型權重發布]
  MODEL --> SIGN
  SIGN --> CDN[受控 HTTPS 發布服務]
  CDN --> PHONE[iPhone 自動更新管理器]
  PHONE --> LDB[(端上 SQLite FTS5 + 本地向量索引)]
  PHONE --> LLM[端上 LLM／Embedding 推論]
  LDB --> QA[端上 RAG 檢索與引用回答]
  LLM --> QA
```

- **Server Vector DB 是官方公開資料的主索引／製作工作區**：儲存公開資料的向量、chunk、來源版本、語言、適用期間、撤回狀態，供管理端重建與發布；絕不存使用者私人文件或私人提問。
- **iOS 不直接即時查 Server Vector DB**：使用者開啟服務時下載已發布的 *public RAG snapshot*，在手機以本地 FTS5／向量索引檢索。這是「Server 有向量資料庫」與「使用者端不送問題、完全端側推理」同時成立的設計。若未來真的要讓伺服器處理公開問題檢索，必須另列選配方案，明示問題會送出，不能再宣稱問答全程離線／無資料外傳。
- **訓練與 RAG 建庫不同**：GPU 微調改變模型權重；Embedding 建立向量資料庫和可發行快照；模型推理在 iOS。官方政策更新時優先重建並發佈知識包，無需每次重新訓練 LLM。
- **資料索引相容性**：向量庫由 `embedding_model_id + revision + dimension + normalize_rule + tokenizer_version` 決定。伺服器建立 chunk embeddings 的模型，必須與手機 query embedding 模型一致，否則拒絕啟用向量搜尋並回退本地 FTS5。

## 24.2 建議的 Server 向量資料模型

以下為**新增的邏輯資料集合**（不改寫舊版 21 張 MariaDB 業務表）：

| 資料實體 | 主要欄位 | 用途 |
|---|---|---|
| `rag_corpora` | `id, name, locale, owner, status` | 官方資料集合 |
| `rag_document_versions` | `id, corpus_id, source_url, source_sha256, effective_from, effective_to, withdrawn_at, review_status` | 版本與追溯 |
| `rag_chunks` | `id, document_version_id, chunk_index, text, source_anchor_json, language, content_sha256` | 原文及來源定位 |
| `rag_embeddings` | `chunk_id, embedding_model_id, embedding_revision, vector, dimension` | 伺服器向量索引（在向量庫內） |
| `rag_snapshot_releases` | `id, corpus_id, release_version, embedding_model_id, manifest_sha256, signature, artifact_uri, status, published_at` | 手機下載索引 |
| `rag_release_entries` | `release_id, chunk_id, chunk_hash, included` | 快照內容可追溯性 |

**儲存選型**：為保留既有 MariaDB，首選獨立 **Qdrant** 儲存 `rag_embeddings`，MariaDB 持有其餘 metadata 與對應 ID；若團隊想減少服務數，可改用 PostgreSQL + pgvector 管理 RAG 子系統，但需新增資料庫、遷移與維運流程。兩者擇一，不在單一原型同時部署。Qdrant 的 payload 可存來源鍵值，但官方全文版本以 MariaDB／物件儲存為準。

資料來源 pipeline：`fetch → canonicalize → dedupe → document version → chunk + anchors → server embedding → upsert vector DB → retrieval evaluation → human review → snapshot → signature → publication`。發布前驗證引用存在、撤回文件已剔除、法規版本適用日期及語言標記。

## 24.3 端上索引與模型數量

- **必備 1 份量化文字 LLM**：用於摘要、受控白話化、資料範圍內問答，依 `task_profile` 切換提示與 Schema，不為每種文件複製完整權重。
- **向量 RAG 建議新增 1 份小型 Query Embedding 模型**：若希望真正使用 Server Vector DB 下發的向量快照，iOS 必須能產生同一向量空間中的 query embedding；P0 也可採 FTS5 baseline，但這時向量資料庫只用於後台建置和後續升級，不應誤稱手機已使用語意向量搜尋。
- **Apple Vision／PDFKit**：本地 OCR 與 PDF 解析，不需要額外發布 GovClear 的 OCR 權重。
- **可選 LoRA adapter**：僅在 runtime 支援、base model revision 完全吻合且品質評估通過時啟用；否則以固定 task profile 路由，避免 32 小時 MVP 面臨多權重相容問題。
- **P0 推薦**：LLM 1 + embedding 1（若實作向量語意 RAG）；或 LLM 1 + FTS5（最小可展示），兩者均為 iPhone 本地推理。模型選擇需要真機內存、延遲、繁中與多語金標驗證，不能僅憑參數量判定可用。

## 24.4 開啟服務就檢查、發現新版就自動下載

本版的明確需求：**每次從關閉狀態開啟服務，必須檢查 manifest**。有網路時以 HTTPS 發送輕量版 `GET /api/v1/runtime/releases?platform=ios&appVersion=...`，帶 `If-None-Match`，`304` 表示無改變；離線時立即採用本地已驗證版本，記錄本次無法檢查。**不能改寫為每 24 小時才檢查**。

```mermaid
flowchart TD
  A[使用者開啟 GovClear] --> B[立即載入本地已驗證模型／知識包]
  A --> C{網路可用?}
  C -->|否| OFF[顯示離線、上次成功檢查時間]
  C -->|是| REQ[每次啟動請求簽章 Manifest，ETag/304]
  REQ --> D{有新版本且相容?}
  D -->|否| KEEP[保留目前版本]
  D -->|是| PLAN[檢查容量、系統版本、依賴、網路政策]
  PLAN --> E{允許下載?}
  E -->|否| PEND[排入待下載並提示原因]
  E -->|是| DL[URLSession 自動下載暫存／顯示進度]
  DL --> VERIFY{SHA256、簽章、自測通過?}
  VERIFY -->|否| FAIL[保留舊版、記錄失敗並稍後重試]
  VERIFY -->|是| SWITCH[安全時點原子切換，保留可回退版本]
  SWITCH --> READY[更新完成，下次請求使用新版]
```

**自動下載的具體政策**：初次安裝時先告知預計總容量與網路使用政策，經一次明確同意後，後續符合政策的更新**自動下載，不需要逐次按更新**；在行動網路、高額流量、磁碟不足或低電量等情況可暫緩大型權重檔，顯示「待更新」和原因。知識包小更新可優先下載，模型大更新以 Wi-Fi 或使用者選定流量門檻處理。

### 更新狀態機

`NOT_INSTALLED → CHECKING → READY | UPDATE_AVAILABLE → DOWNLOADING → VERIFYING → STAGING → ACTIVE`。失敗時轉 `FAILED_RETRYABLE`／`FAILED_BLOCKED`，但舊 `ACTIVE` 不被覆蓋；緊急撤回時依 `mandatory_security` 封鎖危險模型，不能回退至已撤回版本。

### 伺服器 Manifest（示意）

```json
{
  "manifestVersion": 2,
  "platform": "ios",
  "checkedAt": "2026-11-07T08:00:00Z",
  "models": [
    {"key":"govclear-text", "version":"1.0.1", "format":"gguf", "sizeBytes":420000000, "sha256":"<computed>", "signature":"<signed>", "minAppVersion":"1.4.0"},
    {"key":"govclear-embed", "version":"1.0.0", "format":"<runtime-supported>", "sizeBytes":80000000, "sha256":"<computed>", "signature":"<signed>"}
  ],
  "knowledge": [
    {"key":"public-taipei-notices", "version":"2026.11.07", "embeddingModelKey":"govclear-embed", "embeddingModelVersion":"1.0.0", "sha256":"<computed>", "signature":"<signed>"}
  ]
}
```

上例版本與檔案大小只作格式示意，不代表已發布資產。必須同時驗證 key rotation、檔案可信來源、釋出版次、最低 OS／App、runtime ABI／tokenizer、知識包／embedding 依賴與撤回列表。下載 manifest 不能允許任意來源 URL；簽章驗證採預置受信任公鑰。

## 24.5 裝置端查詢與資料保護

```mermaid
sequenceDiagram
  participant U as 使用者
  participant W as iOS WebView
  participant N as Swift 本地工作區
  participant I as iOS 本地索引
  participant M as iOS 本地模型
  U->>W: 問問題／針對文件提問
  W->>N: govclear.local.qa.ask（只傳本地 handle）
  N->>I: FTS5 + query embedding（視套件）
  I-->>N: 已下載公開來源或私人文件的 evidence IDs
  N->>M: 限制來源 prompt + evidence
  M-->>N: 候選回答與引用
  N-->>W: 結構化回答＋來源＋不確定性
  Note over W,M: 不向 Server 發送使用者問題、私人文件、prompt、向量或回答
```

- 公開語料與向量在伺服器由管理流程建置；端上只下載經簽章的公開索引快照。
- 私人公文只建立本機索引，**不可回傳 Server Vector DB**；若本地問答需 embedding，就在手機計算。
- 問答顯示知識包版本、來源原文、資料最後更新；快照過期或撤回需警示，不得無聲使用過期法規。

## 24.6 新增驗收項目

| ID | 測試 | 通過標準 |
|---|---|---|
| V14-01 | Server 將公開 chunk 寫入 Vector DB | 每筆向量可追溯來源版本與段落 ID；無私人資料 |
| V14-02 | Server 匯出 signed RAG snapshot | iOS 可打開索引，chunk 和引用位置一致 |
| V14-03 | 每次服務冷啟動有網路 | 都送出 manifest 檢查；若回 304 不下載模型 |
| V14-04 | 發現相容新版 | 在使用者已允許網路政策下自動下載，不要求再次按確認 |
| V14-05 | 斷網啟動 | 使用舊版本並標示離線，未送個資 |
| V14-06 | 模型檔被竄改 | 簽章／雜湊失敗，不能切換，保留舊版本 |
| V14-07 | embedding 版本不匹配 | 阻止向量查詢；FTS5 降級且 UI 告知 |
| V14-08 | 公告撤回 | 新快照不引用撤回資料；已知撤回版本停止當作有效來源 |
| V14-09 | 私人文件提問 | 抓包證明不向 Server Vector DB 傳任何文件、query 或向量 |
| V14-10 | 更新中執行推理 | 舊版本工作正常結束後切換，避免 runtime 崩潰 |

## 24.7 與既有規格相牴觸的條文處理

- 本文件前面出現「P0 不使用向量資料庫」「不配置任何 GPU」時，均改解釋為：**不設線上推理 GPU**，但保留獨立訓練算力和 **Server Vector DB**。
- 前面出現「知識包只要 FTS5」時，指手機端**最小回退路徑**；正式資料建置須經 Server Vector DB，實際是否啟用手機向量檢索由 embedding 套件與效能驗收決定。
- 前面出現「每 24 小時背景檢查」時，以本章的**每次冷啟動均檢查**為準；TTL、ETag 只用於避免下載不必要的檔案，不可略過 manifest 請求。
- 先前「使用者手動確認更新」只保留首次安裝及網路／儲存政策設定。相容且允許的更新在啟動後自動執行；阻塞時可手動重試。
