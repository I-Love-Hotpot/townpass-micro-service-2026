# TownPass 預覽選單

選單頁面 `/pr-review-menu` 顯示正式站 `https://tp.dstw.dev` 及所有開啟中 PR 的
`https://pr-{number}.tp.dstw.dev` 連結。GitHub 有開啟的 PR 不代表預覽已成功部署。
選單會公開列出 PR 編號與預覽網址，但不公開 PR 標題或 GitHub token；請確認
公開這些網址符合專案需求。預覽網址是否需要登入應由預覽環境自行控管。

## 部署到 Coolify

1. 在 Coolify 使用此分支，部署現有的 `docker-compose.prod.yaml`，沿用既有 frontend、
   backend 和資料庫網路設定。勿新增專用 Dockerfile 或 Compose。
2. 在 Coolify 設定環境變數 `GITHUB_TOKEN`，提供可讀取此倉庫 Pull requests 的
   fine-grained GitHub token（Pull requests: Read-only）；若組織要求 SSO 或核准 token，
   請先完成授權。Compose 只將此 token 提供給 backend，不可加上 `VITE_` 前綴。
3. 在 Coolify 設定 frontend 服務的網域與 HTTPS；資料庫連線及其餘正式環境設定
   仍需依現有部署方式配置。
4. 啟動後開啟 `https://<設定的網域>/pr-review-menu`。Nginx 將同來源的
   `GET /api/pr-preview-links` 代理到同一 Compose 的 backend，不需要額外 CORS 設定。
   所有網域的首頁維持原有行為；PR 列表 API 本身不查詢資料庫，
   但既有後端的健康檢查仍需要資料庫。若在反向代理設定路徑規則，
   也需允許 `/api/pr-preview-links` 及前端靜態資源通過。

API 成功時只回傳 JSON 網址陣列，例如：

```json
["https://tp.dstw.dev", "https://pr-123.tp.dstw.dev"]
```

取得 GitHub 資料失敗時回傳非 2xx 狀態和錯誤訊息，不會假裝列表為空。API 有 GitHub
速率限制且無身分驗證；如需限制誰能查看網址或避免濫用，應在反向代理另外設定存取控制。

## 本地開發

依專案既有方式設定資料庫，並在 shell 設定 `GITHUB_TOKEN` 後啟動後端：

```sh
cd backend
npm run dev
```

在另一個終端機執行：

```sh
cd frontend
pnpm dev
```

開啟 Vite 顯示的網址並前往 `/pr-review-menu`，開發伺服器會將 API 請求代理到
`localhost:3001`。既有首頁維持不變。

## 故障排除

- 後端回傳 503：確認後端有設定 `GITHUB_TOKEN` 並重新啟動。
- GitHub 回傳 401：token 無效、已過期或已撤銷，請建立新的 token。
- GitHub 回傳 403、404 或 429：檢查倉庫授權、組織 SSO 及 GitHub API 速率限制。
- 若曾使用 `VITE_GITHUB_TOKEN` 建置或部署，請撤銷舊 token；`VITE_` 變數會暴露給前端。
- 預覽連結無法開啟：確認該 PR 的 Coolify 預覽已部署並設定 DNS。
