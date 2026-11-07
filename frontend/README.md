# TownPass-Services

TownPass-Services project made with Vue3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```

## GovClear 文件摘要微服務

介面位於 `src/views/GovClearView.vue`，路由 `/govclear`。執行 `pnpm dev:govclear`，再從 TownPass 的 GovClear WebView 入口測試文字摘要、圖片辨識與校正後摘要。詳細說明見 [GovClear 微服務與 Flutter 容器](../docs/govclear-webview.md)。

圖片摘要已支援多選（最多 5 張）、排序、移除、逐張辨識與文字校正，再合併為整份摘要。單張上限 20 MB、合計 50 MB；合併文字上限 6,000 字。點「載入範例」可加入兩張合成通知。多圖與橋接測試：`node --test tests/*.test.mjs`。
