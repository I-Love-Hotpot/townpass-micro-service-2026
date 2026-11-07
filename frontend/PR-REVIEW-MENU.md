# TownPass 預覽選單

選單首頁顯示正式站 `https://tp.dstw.dev` 及所有開啟中 PR 的
`https://pr-{number}.tp.dstw.dev` 連結。GitHub 有開啟的 PR 不代表預覽已成功部署。
選單會公開列出 PR 編號與預覽網址，但不公開 PR 標題或 GitHub token；請確認
公開這些網址符合專案需求。預覽網址是否需要登入應由預覽環境自行控管。

## 部署到 Coolify

1. 在 Coolify 建立使用此分支及根目錄 `docker-compose.pr-menu.yaml` 的 Compose 服務。
2. 在 Coolify 設定 secret 環境變數 `GITHUB_TOKEN`，提供可讀取此倉庫 Pull requests 的
   fine-grained GitHub token（Pull requests: Read-only）；若組織要求 SSO 或核准 token，
   請先完成授權。token 只提供給 `pr-backend` 容器，不可加上 `VITE_` 前綴。
3. 只將 `pr-menu` 服務的 80 port 對外綁定 `https://index.tp.dstw.dev`；
   不要公開 `pr-backend` 的 3001 port。設定 DNS 及 HTTPS。
4. 啟動後開啟 `https://index.tp.dstw.dev/`。Nginx 將同來源的
   `GET /api/pr-preview-links` 代理到後端，不需要 CORS 設定或資料庫。

API 成功時只回傳 JSON 網址陣列，例如：

```json
["https://tp.dstw.dev", "https://pr-123.tp.dstw.dev"]
```

取得 GitHub 資料失敗時回傳非 2xx 狀態和錯誤訊息，不會假裝列表為空。API 有 GitHub
速率限制且無身分驗證；如需限制誰能查看網址或避免濫用，應在反向代理另外設定存取控制。

## 本地開發

在專案根目錄的 shell 設定 `GITHUB_TOKEN` 後，執行：

```sh
node backend/src/pr-menu-server.js
```

在另一個終端機執行：

```sh
cd frontend
VITE_PR_MENU_HOME=true pnpm dev
```

開啟 Vite 顯示的網址，開發伺服器會將 API 請求代理到 `localhost:3001`。
沒有設定 `VITE_PR_MENU_HOME=true` 時，既有首頁維持不變，選單仍可透過
`/pr-review-menu` 存取。

## 故障排除

- 後端回傳 503：確認後端有設定 `GITHUB_TOKEN` 並重新啟動。
- GitHub 回傳 401：token 無效、已過期或已撤銷，請建立新的 token。
- GitHub 回傳 403、404 或 429：檢查倉庫授權、組織 SSO 及 GitHub API 速率限制。
- 若曾使用 `VITE_GITHUB_TOKEN` 建置或部署，請撤銷舊 token；`VITE_` 變數會暴露給前端。
- 預覽連結無法開啟：確認該 PR 的 Coolify 預覽已部署並設定 DNS。
