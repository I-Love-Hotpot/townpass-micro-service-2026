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
舊整合文件中的 Direct Upload 指令只適用於手動部署，不代表目前的正式更新流程。
