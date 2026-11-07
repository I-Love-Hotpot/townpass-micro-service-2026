# 文件四角定位與透視校正

本次修改僅在 micro-service 前端；沒有修改 Flutter、Swift 或 OCR 引擎。

## 架構與操作

`ScanView.vue` 的相機 `capture="environment"` 與相簿 file input 共用新增流程。每張照片先進入 `DocumentCrop.vue`，確認後才更新 `ImagePage.file`；全部照片都確認後，使用者按既有辨識按鈕開始 OCR。多張照片依序確認；PDF 保留既有逐頁渲染與 OCR 流程。

四角調整提供遮罩、44 CSS px 的獨立觸控目標、Pointer Capture、鍵盤方向鍵微調、2.5 倍原圖放大鏡、重新偵測、旋轉、重設及原圖旁路。選區限制為順時針凸四邊形，面積至少為原圖 1%。取消保留草稿；返回調整、重新開啟、橫直向切換都保留座標。重新確認圖片會清除該頁舊 OCR 文字與完成狀態，避免沿用舊影像的辨識結果。

圖片處理使用瀏覽器 Canvas 2D，未新增影像處理相依套件。座標為 EXIF 解碼後原圖的 0～1 座標，依 TL、TR、BR、BL 排列；旋轉另外記錄 turns，座標相對於該旋轉方向。顯示 Canvas 最長邊 1,400 px，CSS 維持圖片比例；拖曳以實際圖片元素的 bounding rect 換算，不包含 contain 留白，也不乘 devicePixelRatio。放大鏡直接取樣原圖 Canvas。

`documentCrop.ts` 計算四點 inverse Homography，將矩形輸出逐像素映射回原圖，以雙線性取樣完成真正的 perspective warp。寬高依相對邊的較長邊決定，最長邊 3,200 px，沒有固定成正方形。原圖 PNG/JPEG header 在解碼前檢查尺寸，上限 1,600 萬像素；超過時明確要求縮小或使用原圖，不默默降低原始裁切解析度。透明 PNG 在白底合成。現代 WebView 的圖片解碼器處理 EXIF，不重複套用方向。

自動偵測在最長邊 640 px 的灰階影像上，依亮度與對比做兩組閾值、連通區輪廓、凸包及四邊形近似；用輪廓吻合、區域填滿率、面積與碰觸影像邊界程度評分，並非只挑最大區域。這是亮紙／暗背景的保守偵測器，不是通用語意文件偵測器。低信心時選取整張圖，提示手動調整；低對比／模糊提醒也是啟發式，不能當作清晰度保證。複雜背景、陰影、深色文件或多份文件需人工確認。

## OCR 與取消

`ImagePage.original` 永遠保留最初 Blob/File；校正結果是獨立 JPEG Blob，暫存於記憶體與 object URL，沒有要求 Native 新增磁碟暫存 API。既有 `recognizeDocument` 仍讀取 `page.file`、base64 編碼並送 `govclearNative.transcribe`。保存紀錄時 `originals` 是原圖，`pages` 是最後確認的 OCR 圖片；IndexedDB schema 與文字回傳契約不變。

偵測／校正／預覽／確認有明確狀態；忙碌時禁止重複確認。透視運算每 32 列讓出事件迴圈並檢查取消。離開畫面中止舊工作；切到背景中止校正、保留角點並要求重試；舊結果不可寫回新工作。Blob 輸出失敗保留預覽並允許重試。尚未確認照片無法繞過選取流程直接辨識。

## 可重跑的測試

```sh
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
pnpm --dir frontend dev --host 127.0.0.1 --port 5178 --strictPort
```

另開 terminal 執行瀏覽器測試。Playwright 僅安裝到外部測試目錄，不加入產品 runtime：

```sh
npm install --prefix /tmp/townpass-crop-tests playwright --no-audit --no-fund
# Chromium 預設為 /opt/homebrew/bin/chromium；可用 CHROMIUM_PATH 指定執行檔。
PLAYWRIGHT_MODULE=/tmp/townpass-crop-tests/node_modules/playwright/index.mjs \
  node frontend/tests/documentCrop.browser.mjs
/tmp/townpass-crop-tests/node_modules/.bin/playwright install webkit
CROP_TEST_BROWSER=webkit \
PLAYWRIGHT_MODULE=/tmp/townpass-crop-tests/node_modules/playwright/index.mjs \
  node frontend/tests/documentCrop.browser.mjs
```

測試僅使用程式生成的無個資文件，包含已知梯形角點、文字與四個角落附近的色標。

本輪結果（2026-11-08）：

- Node 單元／回歸測試 35 項通過：包含凸四邊形、交叉／小面積拒絕、Homography 四角與直線、旋轉、顯示座標、輸出上限、已知角點偵測與失敗退回、PNG/JPEG 尺寸讀取。
- Chromium UI／整合通過：DPR 3、小螢幕直橫向、拖曳、放大鏡原圖色標取樣、鍵盤、返回／取消重開保留角點、比較原圖、預覽不自動 OCR、Blob 暫存失敗後重試、相機匯入與原圖旁路。Native 使用明確的測試替身，驗證收到的 base64 與確認預覽 JPEG 完全相同，並保存不同的原圖／校正 Blob。
- 影像瀏覽器測試驗證四個角落附近色標全部保留、EXIF 1～8（含鏡像）的尺寸與像素方向、1,200 萬像素輸出上限、過大圖片在解碼前拒絕、校正前／校正中取消。
- Lint、型別檢查與 production build 通過；build 有既有 PDF 大 chunk 與 Browserslist 資料過期提示。
- WebKit 的完整保存測試未通過：Playwright WebKit 在此機器連獨立的 `new Blob(['test'])` 寫入 IndexedDB 都回 `UnknownError: Error preparing Blob/File data to be stored in object store`。這個最小重現不經本功能或 records service。測試預設仍嚴格失敗；可明確加 `CROP_TEST_ALLOW_BLOB_STORAGE_FAILURE=1`，僅在同樣的獨立 Blob 基線也失敗時繼續其餘影像／UI／OCR 傳遞測試，並印出保存未通過。不得把這個選項視為保存驗收成功。

## 平台相容性與尚未驗證

四角 UI 與影像運算共用 Vue／Canvas／Pointer Events，可沿用 iOS WKWebView 與 Android WebView 的既有圖片回傳，不需要 OpenCV Native 編譯或 Flutter 新橋接。這是實作層相容性，並非 Android／iOS 實機驗收完成。

旁邊的 `TownPass-merge` host 使用 `townpass/govclear_local` MethodChannel 與 iOS Swift 離線引擎，Debug 模擬器 transport 也明確限制 iOS；本次沒有新增 Android OCR 引擎。Android 完整 OCR 能力仍由 host 決定，不能宣稱兩個平台都完成真實端到端推論。

仍需實機驗證：Android／iOS 相機與相簿權限及檔案回傳、EXIF 各方向（含鏡像）、實際指尖拖曳／放大鏡定位、背景切換／低記憶體／最高支援解析度效能、真實拍攝文件偵測品質、WKWebView 原圖與校正 Blob 的持久化，以及真實 Native OCR 品質。頁面重整或 WebView 被系統回收時，尚未保存的選圖／角點草稿會遺失；一般前後景切換保留角點或安全中止運算。
