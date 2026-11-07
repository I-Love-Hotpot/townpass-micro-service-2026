# 白話人 · TownPass 微服務前端

在微服務 repo 的 `frontend` 目錄使用 Node.js 22.13+ 和 pnpm 10。

```sh
pnpm install --frozen-lockfile
pnpm dev:local
```

開啟 [localhost:3000](http://localhost:3000/)。這個流程使用 Vite，既有 Docker 開發容器的前端連接埠仍為 5173。

- 「掃描」可選最多 20 張 JPG／PNG／WebP，單張 10 MiB、合計 50 MiB，或一份 25 MiB、50 頁內的 PDF。選檔後直接處理，完成時開啟詳情。
- 「紀錄」用 IndexedDB 保存原檔、逐頁圖片、摘要與追問。資料依瀏覽器及網站來源隔離。卡片底部可刪除整份文件。
- 可在設定頁手動從上層工作區的 `docs/idea/papers/` 匯入 14 份範例。首次匯入需要轉圖時間，之後從瀏覽器讀取。刪除範例後重整仍保持刪除。獨立 clone 缺少素材時，紀錄從空清單開始，可自行選檔。正式 build 不包含原始範例檔。
- 新選文件透過 release Native Bridge 實際 OCR、摘要、重新解釋與追問，合併原文上限 6,000 字。瀏覽器沒有原生 host 時會顯示錯誤；不以範例摘要替代。辦理狀態與服務跳轉維持示意。詳見 [整合說明](../docs/integration-main-offline.md)。
- [印尼文預覽](http://localhost:3000/?lang=id) 可測試「重新解釋」。已保存的摘要保持原語言，使用者觸發後才更新。
- 網頁預設隱藏 header，由原生 App 提供返回與關閉。使用 [header 預覽](http://localhost:3000/?header=1) 顯示網頁自己的 header，使用 [嵌入版面](http://localhost:3000/?embedded=1) 測試全寬內容。網頁採 hash 路由，重整文件詳情時可直接回看。
- 依微服務 README 保留 Flutter bridge composables。正式 App 語言及服務跳轉的訊息契約待 App 整合時定義。

```sh
pnpm lint
pnpm test
pnpm type-check
pnpm build
```

`pnpm test` 驗證 Native 訊息、OCR 頁序、字數限制、摘要、取消、內容匹配、IndexedDB 保存與刪除，以及重新解釋的更新交易。
