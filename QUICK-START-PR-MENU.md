# PR Review Menu - 快速開發指南

## 🚀 快速開始

### 1. 切換到功能分支
```bash
git checkout feature/pr-review-menu
```

### 2. 安裝依賴並啟動開發服務器
```bash
cd frontend
pnpm install
pnpm run dev
```

### 3. 訪問 PR 選單頁面
```
http://localhost:5173/pr-review-menu
```

## 🔧 配置（可選）

如果需要使用私有倉庫或提高 API 限制，在 `frontend/.env.local` 中設置：

```env
VITE_GITHUB_OWNER=your-org
VITE_GITHUB_REPO=your-repo
VITE_GITHUB_TOKEN=github_pat_xxxxxxx
```

## 📁 文件說明

| 文件 | 說明 |
|------|------|
| `frontend/src/views/PRReviewMenuView.vue` | PR 選單主視圖組件 |
| `frontend/src/composables/usePRList.ts` | PR 列表邏輯（獲取、處理事件） |
| `frontend/src/router/index.ts` | 路由配置 |
| `frontend/PR-REVIEW-MENU.md` | 完整文檔 |
| `frontend/.env.example.pr-menu` | 環境配置示例 |

## 🎯 功能特性

- ✅ 自動從 GitHub API 獲取所有開啟的 PR
- ✅ 顯示 PR 基本信息（標題、編號、狀態、建立時間）
- ✅ 一鍵預覽 PR（跳轉到 `{pr-id}.tp.dstw.dev`）
- ✅ 一鍵前往 GitHub PR 頁面
- ✅ 人性化的時間顯示（相對時間，使用 date-fns）
- ✅ 美觀的 UI 設計（Tailwind CSS）
- ✅ 錯誤處理和加載狀態

## 🐛 常見問題

### Q: 無法載入 PR 列表
**A**: 
1. 檢查網絡連接
2. 檢查 GitHub API 是否可用
3. 如果是私有倉庫，設置 `VITE_GITHUB_TOKEN`
4. 打開瀏覽器開發者工具（F12），查看 Console 中的錯誤信息

### Q: 預覽連結無法訪問
**A**: 
1. 確保 Coolify 或部署服務正在運行
2. 驗證 PR 的預覽環境已部署
3. 檢查 `.env.local` 中的 `VITE_PR_PREVIEW_DOMAIN` 設置

### Q: API 限制太低
**A**: 設置 GitHub Personal Access Token：
```bash
# 1. 在 GitHub 創建 Token
# https://github.com/settings/tokens

# 2. 在 .env.local 中設置
VITE_GITHUB_TOKEN=your_token_here

# 3. 重新啟動開發服務器
pnpm run dev
```

## 📝 開發筆記

- 組件使用 Vue 3 + TypeScript
- 樣式使用 Tailwind CSS
- 時間格式化使用 date-fns（支持中文 locale）
- 路由使用 Vue Router v4
- 所有外部連結在新標籤頁打開（避免丟失開發進度）

## 🔄 提交流程

1. 在 `feature/pr-review-menu` 分支上開發
2. 提交代碼：`git commit -m "feat/fix: ..."`
3. 推送到遠程：`git push origin feature/pr-review-menu`
4. 在 GitHub 上創建 Pull Request（PR）

## 📚 參考資源

- [GitHub REST API - Pulls](https://docs.github.com/en/rest/pulls/pulls)
- [Vue 3 Documentation](https://vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [date-fns Documentation](https://date-fns.org/)

---

**分支**: `feature/pr-review-menu`  
**路由**: `/pr-review-menu`  
**狀態**: 開發中，用於測試
