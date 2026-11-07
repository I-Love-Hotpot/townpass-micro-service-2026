# 白話人 · TownPass 微服務前端

在微服務 repo 的 `frontend` 目錄使用 Node.js 22.13+ 和 pnpm 10。

```sh
pnpm install --frozen-lockfile
pnpm dev:local
```

開啟 [localhost:3000](http://localhost:3000/)。這個流程使用 Vite，既有 Docker 開發容器的前端連接埠仍為 5173。

- 「掃描」可選最多 5 張 JPEG／PNG，單張 20 MB、合計 50 MiB，或一份 25 MiB、50 頁內的 PDF。選檔後直接處理，完成時開啟詳情。
- 「紀錄」用 IndexedDB 保存原檔、逐頁圖片、摘要與追問。資料依瀏覽器及網站來源隔離。卡片底部可刪除整份文件。
- 可在設定頁手動從上層工作區的 `docs/idea/papers/` 匯入 14 份範例。首次匯入需要轉圖時間，之後從瀏覽器讀取。刪除範例後重整仍保持刪除。獨立 clone 缺少素材時，紀錄從空清單開始，可自行選檔。正式 build 不包含原始範例檔。
- 新選文件透過 release Native Bridge 實際 OCR、摘要、重新解釋與追問，合併原文上限 6,000 字。瀏覽器沒有原生 host 時會顯示錯誤；不以範例摘要替代。辦理狀態與服務跳轉維持示意。詳見 [整合說明](../docs/integration-main-offline.md)。
- [印尼文預覽](http://localhost:3000/?lang=id) 可測試「重新解釋」。已保存的摘要保持原語言，使用者觸發後才更新。
- 微服務 header 由 TownPass 原生提供返回與關閉，網頁預設隱藏。使用 [header 預覽](http://localhost:3000/?header=1) 顯示網頁自己的 header，使用 [嵌入版面](http://localhost:3000/?embedded=1) 測試全寬內容。網頁採 hash 路由，重整文件詳情時可直接回看。
- 依微服務 README 保留 Flutter bridge composables。正式 App 語言及服務跳轉的訊息契約待 App 整合時定義。

```sh
pnpm lint
pnpm test
pnpm type-check
pnpm build
```

`pnpm test` 驗證 Native 訊息、OCR 頁序、字數限制、摘要、取消、內容匹配、IndexedDB 保存與刪除，以及重新解釋的更新交易。

## GitHub Releases

`main` 分支的前端檔案有更新時，GitHub Actions 會執行 `pnpm build`，並建立包含 `dist/` 的 `townpass-baihua-frontend-dist.zip` Release asset。Release tag 使用 `frontend-<commit-sha>` 格式，client 可從 latest release 的 `tag_name` 取得建置 SHA，不需要額外的 `version.json`。

若 repo 是公開的，外部可透過以下網址下載最新版本：

- ZIP：`https://github.com/<owner>/<repo>/releases/latest/download/townpass-baihua-frontend-dist.zip`

Client 首次下載 ZIP 後，應保存該 Release tag 中的 commit SHA。每次開啟服務時可用下列流程檢查及更新：

1. 呼叫公開 API：`GET https://api.github.com/repos/I-Love-Hotpot/townpass-micro-service-2026/releases/latest`。
2. 從回應的 `tag_name` 去除 `frontend-` 前綴，取得最新 Release 的 commit SHA。
3. SHA 相同就不需更新；不同時，從同一份 Release 的 `assets` 取得 `townpass-baihua-frontend-dist.zip` 的 `browser_download_url` 並下載，成功後再保存新 SHA。先下載並確認成功再更新已保存的 SHA，避免下載失敗後 client 誤以為已更新。

此流程適用於公開 repo，無須 GitHub token；GitHub API 對未驗證請求有頻率限制。

拍照可連續累積多張後再開始辨識，支援相簿追加、排序與移除。OCR 文字可人工修正，摘要完成後自動產生六何，並可重新整理與複製。固定預覽：<https://townpass.fearnot.tw>。

網站由 Cloudflare Pages 專案 `townpass` 託管，不需要本機持續開機。目前採手動部署，修改程式後需重新 build 與上傳，沒有 Git 自動部署；部署指令見 [固定公開預覽](../docs/integration-main-offline.md#固定公開預覽)。

正式 build 會產生完整版本的 Service Worker 快取。首次在線開啟後，等待上方顯示「完整離線版本已備妥」即可離線重新開啟；下載中斷可重試，更新失敗保留上一個完整版本。App 不再附帶 localhost 頁面備援。新功能需部署網站及重新打包 App；清除網站資料後需重新連網。詳見整合說明的「線上首次下載與離線快取」。
