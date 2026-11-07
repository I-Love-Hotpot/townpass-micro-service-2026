# 摘要與六何結果儲存

六何成功後，前端自動 POST `/api/govclear/results`。傳送摘要依據的原文（sourceText）、摘要、六何、隨機結果編號、產生時間與輸入類型；不傳圖片檔或檔名。文字模式的 sourceText 是本次摘要使用的輸入文字；圖片模式是辨識及修正後、依頁序合併的文字。原文與摘要可能含有個人資訊。舊版 App 未傳 sourceText 時仍可儲存；既有紀錄不會自動補入原文。

## 本機啟用

1. 啟動既有 Docker Compose 微服務。
2. 建立資料表：`docker compose exec -T dev-backend npm run results:init`。
3. 在 `frontend/.env.local` 設定 `VITE_GOVCLEAR_RESULTS_API_URL=http://192.168.88.173:3001/api/govclear/results`（換成電腦實際 IP）。重啟 Vite 或重新 build、打包手機 App。
4. 手機與電腦使用同一區網，允許 App 區域網路存取，電腦服務保持運行。

未設定網址時不會上傳。此端點供目前區網測試；目前未實作帳號驗證，上正式環境前應接入既有認證及 HTTPS，不應直接公開於網際網路。CORS_ALLOWED_ORIGINS 必須包含手機介面來源 `http://127.0.0.1:5173`。

## 如何查看

前端結果下方「結果 JSON」會顯示儲存狀態及結果編號；展開「查看送出 JSON」或按「複製 JSON」。顯示 JSON 不代表儲存成功，請確認狀態為「已儲存到後端」。

在微服務專案目錄執行：

```sh
# 最近十筆結果編號
 docker compose exec -T dev-backend npm run results:list
# 將 RESULT_ID 換成畫面上的結果編號，查看實際儲存的 JSON
 docker compose exec -T dev-backend npm run results:show -- RESULT_ID
```

MariaDB 的 `govclear_results` 表儲存完整 JSON。沒有公開讀取結果的 GET API。

## 格式與重試

```json
{
  "schemaVersion": 1,
  "resultId": "bfca0971-800d-450d-bc36-d7e69126520e",
  "generatedAt": "2026-11-08T00:00:00Z",
  "inputMode": "text",
  "summary": "請於期限前補交資料。",
  "sourceText": "申請人應於通知期限屆滿前，透過線上系統補交所需資料。",
  "sixQuestions": {
    "who": "申請人", "what": "補交資料", "when": null,
    "where": null, "why": null, "how": "線上提交"
  }
}
```

六何缺少資訊使用 null；六個欄位皆須存在。API 新增回應 201，同編號同內容重送回應 200，同編號不同內容回應 409。上傳等候 15 秒後可手動重試，沿用同一編號避免重複新增。六何未成功時不送出不完整資料。不會重新呼叫模型來上傳。

待送資料只保留在目前頁面；離開頁面前請確認成功或複製 JSON。取消連線不會刪除後端已收到的結果。
