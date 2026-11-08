# Cloudflare Pages 自動部署

正式站：<https://townpass.fearnot.tw>（Pages 專案 `townpass`）。

GitHub 來源為 `I-Love-Hotpot/townpass-micro-service-2026`。
推送或合併到 `main` 會觸發 Cloudflare Pages 建置；成功後自動更新正式站。
其他分支目前會產生預覽部署。

Cloudflare Pages 的 Settings → Builds 設定：

| 設定 | 值 |
| --- | --- |
| Production branch | `main` |
| Automatic production deployments | Enabled |
| Root directory | `frontend` |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| `NODE_VERSION` | `22` |
| `PNPM_VERSION` | `11.25.0` |

環境變數同時設定於 Production 與 Preview。依賴由 Pages 依照
`frontend/pnpm-lock.yaml` 安裝，不需要手動上傳 `dist`。

在 Pages 的 Deployments 確認部署 commit 與 GitHub `main` 相符，且建置及部署均成功。
失敗時查看該次部署的 Build log；修正後推送下一個 commit 即可重新觸發。

這個流程只更新遠端網頁。手機 App 內打包的離線介面及原生程式仍須另行打包安裝。
正式發布僅使用 GitHub `main` 自動部署；其他分支由 Git 產生 Preview。依使用者指示，不再執行 Wrangler 或其他 Direct Upload 手動發布。建置失敗時修正 Git 提交，再由 GitHub 重新觸發；不可用本機 `dist` 覆蓋正式站。
