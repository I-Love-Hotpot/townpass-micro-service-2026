# PR Review Menu - 開發測試功能

## 簡介

此功能提供一個選單頁面，可以列出目前所有開啟的 Pull Request，並支持直接跳轉到 PR 的預覽環境或 GitHub 頁面。

## 功能特性

- ✅ 從 GitHub API 自動獲取所有開啟的 PR
- ✅ 顯示 PR 的基本信息（標題、編號、狀態、建立時間）
- ✅ 支持點擊跳轉到預覽環境 `{pr-id}.tp.dstw.dev`
- ✅ 支持點擊跳轉到 GitHub PR 頁面
- ✅ 人性化的時間顯示（相對時間）
- ✅ 美觀的 UI 設計，使用 Tailwind CSS

## 訪問方式

### 本地開發
```bash
# 1. 啟動前端開發服務器
cd frontend
pnpm install
pnpm run dev
```

訪問 http://localhost:5173/pr-review-menu

### 生產環境
訪問 https://your-domain/pr-review-menu

## 文件結構

```
frontend/src/
├── composables/
│   └── usePRList.ts           # PR 列表獲取邏輯和事件處理
├── views/
│   └── PRReviewMenuView.vue    # PR 選單主視圖
└── router/
    └── index.ts               # 路由配置
```

## 技術棧

- **框架**: Vue 3 + TypeScript
- **樣式**: Tailwind CSS
- **路由**: Vue Router
- **時間格式化**: date-fns
- **API**: GitHub REST API

## 使用的 API

### GitHub REST API
```
GET https://api.github.com/repos/{owner}/{repo}/pulls?state=open&per_page=50
```

**參數**:
- `owner`: `I-Love-Hotpot`
- `repo`: `townpass-micro-service-2026`
- `state`: `open` (只獲取開啟的 PR)
- `per_page`: `50` (每頁最多 50 個)

**API 限制**:
- 無身份驗證的請求：每小時 60 次
- 建議在生產環境使用 GitHub Token 提高限制到每小時 5000 次

## 環境配置

### 必需配置

如果倉庫是私有的或你需要提高 API 限制，請在 `frontend/.env.local` 中設置以下環境變數：

```env
# GitHub Repository Information (如果需要修改)
VITE_GITHUB_OWNER=I-Love-Hotpot
VITE_GITHUB_REPO=townpass-micro-service-2026

# GitHub Personal Access Token (推薦用於提高 API 限制)
VITE_GITHUB_TOKEN=your_github_token_here

# PR Preview 域名配置 (如果需要修改)
VITE_PR_PREVIEW_DOMAIN=tp.dstw.dev
```

參考 [.env.example.pr-menu](.env.example.pr-menu)。

### 獲取 GitHub Token

1. 登入 GitHub 帳戶
2. 進入 Settings → Developer settings → Personal access tokens
3. 創建新 token，選擇 `repo` 權限
4. 複製 token 並設置到 `.env.local`

**注意**: 不要將 token 提交到版本控制系統！確保 `.env.local` 在 `.gitignore` 中。

## 開發中的限制

此功能目前為開發測試用途，有以下已知限制：

1. **無分頁**: 目前只獲取前 50 個 PR，超過此數量的 PR 不會顯示
2. **無緩存**: 每次訪問都會向 GitHub API 發出請求
3. **無身份驗證**: 使用無身份驗證的 API，受到 GitHub 速率限制
4. **預覽 URL 硬編碼**: 預覽域名目前為 `{pr-id}.tp.dstw.dev`

## 安全考慮

- ✅ 所有外部連結都在新標籤頁打開（`_blank`）
- ✅ 沒有接收用戶輸入，不存在 XSS 風險
- ✅ 只從官方 GitHub API 獲取數據
- ⚠️ 未使用 GitHub Token，受到速率限制

## 未來改進

- [ ] 支持分頁，展示超過 50 個的 PR
- [ ] 添加 PR 搜索和過濾功能
- [ ] 緩存 PR 列表，減少 API 請求
- [ ] 支持 GitHub Token 認證，提高 API 限制
- [ ] 顯示 PR 的詳細信息（標籤、作者、審核狀態等）
- [ ] 支持同時展示已關閉的 PR
- [ ] 添加自動刷新功能
- [ ] 支持自定義預覽域名配置

## 故障排除

### 無法載入 PR 列表

**可能原因**:
1. 網絡連接問題
2. GitHub API 速率限制（無身份驗證超過 60 個請求/小時）
3. 倉庫不存在或無法訪問

**解決方案**:
1. 檢查網絡連接
2. 等待 1 小時後重試
3. 在代碼中添加 GitHub Token
4. 檢查倉庫名稱和所有者是否正確

### 預覽連結無法訪問

**可能原因**:
1. Coolify 部署服務未運行
2. PR 的預覽環境尚未建立
3. 預覽域名配置錯誤

**解決方案**:
1. 檢查 Coolify 服務狀態
2. 等待 PR 預覽環境部署完成
3. 驗證預覽域名配置是否與實際服務匹配

## 提交信息

此功能在分支 `feature/pr-review-menu` 上開發。

## 相關文件

- [PRReviewMenuView.vue](/Users/swchen1217/meichu26/townpass-micro-service-2026/frontend/src/views/PRReviewMenuView.vue) - 主視圖組件
- [usePRList.ts](/Users/swchen1217/meichu26/townpass-micro-service-2026/frontend/src/composables/usePRList.ts) - 組合函數
- [router/index.ts](/Users/swchen1217/meichu26/townpass-micro-service-2026/frontend/src/router/index.ts) - 路由配置
