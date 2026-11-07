# TownPass 微服務架構

城市通（TownPass）微服務平台是一個現代化的城市服務整合系統，提供公民報案、規費繳納、圖書館管理、優惠券等多項城市服務。本系統採用微服務架構，實現前後端分離，並通過 Flutter 應用的內嵌 WebView 進行交互。

## 📋 目錄

- [架構總覽](#架構總覽)
- [技術棧](#技術棧)
- [Flutter-WebView 通訊層](#flutter-webview-通訊層)
  - [訊息交互模型](#訊息交互模型)
  - [Data Model 定義](#data-model-定義)
- [系統構成](#系統構成)
- [快速開始](#快速開始)
- [API 文檔](#api-文檔)
- [開發指南](#開發指南)

---

## 架構總覽

```
┌─────────────────────────────────────────────────────┐
│                  Flutter App (iOS/Android)          │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │      flutter_inappwebview WebView           │   │
│  │                                             │   │
│  │  ┌──────────────────────────────────────┐  │   │
│  │  │   Vue 3 Frontend Application         │  │   │
│  │  │  (HTML/CSS/TypeScript/Vue Components)│  │   │
│  │  └──────────────────────────────────────┘  │   │
│  │                                             │   │
│  │  ◄────────► WebMessageListener API         │   │
│  │             (window.flutterObject)        │   │
│  └─────────────────────────────────────────────┘   │
│                       ▲                             │
│                       │                             │
│      ┌────────────────┴────────────────┐            │
│      │ Structured JSON Messages        │            │
│      │ (postMessage/addEventListener)  │            │
│      └────────────────┬────────────────┘            │
└─────────────────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │   HTTPS Communication   │
          └────────────┬────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│         Backend Microservices (Node.js)             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         Fastify REST API Server             │   │
│  │  • Health Check Endpoints                   │   │
│  │  • Service Endpoints                        │   │
│  │  • CORS Support                             │   │
│  └─────────────────────────────────────────────┘   │
│                       ▼                             │
│  ┌─────────────────────────────────────────────┐   │
│  │       MariaDB/MySQL Database                │   │
│  │  • User Data                                │   │
│  │  • Service Records                          │   │
│  │  • Transaction Logs                         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 技術棧

### 前端層（Frontend）

| 技術                        | 版本   | 用途                          |
|---------------------------|--------|-------------------------------|
| **Vue.js**                | 3.4.21 | UI 框架，組件化開發           |
| **TypeScript**            | ~5.4.0 | 類型安全的開發語言            |
| **Vite**                  | 5.2.8  | 現代化構建工具                |
| **Vue Router**            | 4.3.0  | 應用程式路由管理              |
| **Pinia**                 | 2.1.7  | 狀態管理（Vue 3 官方推薦）    |
| **Tailwind CSS**          | 3.4.4  | 功能化 CSS 框架               |
| **Axios**                 | 1.7.2  | HTTP 客戶端                   |
| **Google Maps API**       | 3.55.10| 地圖服務集成                  |
| **Marker Clusterer**      | 2.5.3  | 地圖標記聚類                  |
| **QRCode.Vue**            | 3.4.1  | QR 碼生成                     |
| **V-Calendar**            | 3.1.2  | 日期選擇器                    |
| **HeadlessUI/Vue**        | 1.7.22 | 無樣式 UI 組件                |

**構建與開發：**
- pnpm: 包管理
- ESLint: 代碼檢測
- Prettier: 代碼格式化
- Docker: 容器化部署

### 後端層（Backend）

| 技術                     | 版本  | 用途                      |
|-------------------------|-------|---------------------------|
| **Node.js**             | 22    | 運行時環境                |
| **Fastify**             | 5.0.0 | 高性能 Web 框架           |
| **MySQL2**              | 3.0.0 | 數據庫連接器              |
| **CORS**                | 11.0.0| 跨域資源共享              |
| **Swagger UI**          | 6.1.3 | API 文檔展示              |
| **Swagger**             | 9.0.0 | API 文檔生成              |

### 基礎設施與運維

| 技術                   | 版本 | 用途                      |
|----------------------|------|---------------------------|
| **MariaDB**          | 11   | 關聯式資料庫              |
| **Docker**           | -    | 容器化部署                |
| **Docker Compose**   | -    | 容器編排                  |
| **Nginx**            | -    | 反向代理 & 靜態文件服務  |
| **Adminer**          | -    | 數據庫管理工具            |

### 原生端（Flutter）

| 技術                         | 用途                                  |
|---------------------------|---------------------------------------|
| **Flutter**               | 跨平台移動應用框架                    |
| **flutter_inappwebview**  | 原生 WebView 容器，支持 JS 通訊      |
| **WebMessageListener API**| 實現 Web ◄-► Native 雙向通訊         |

---

## Flutter-WebView 通訊層

### 訊息交互模型

此微服務採用 **Flutter 應用內嵌 WebView** 的架構。Web 應用運行在 Flutter 提供的 `flutter_inappwebview` WebView 容器中，通過 **WebMessageListener API** 與原生層進行雙向通訊。

#### 核心通訊機制

```
Web 側 (Vue.js)                      Native 側 (Flutter)
        │                                    │
        │  useConnectionMessage()            │
        │  window.flutterObject              │
        │        .postMessage(data) ────────►│
        │                                    │  WebMessageListener
        │                                    │  監聽訊息
        │                                    │  執行原生功能
        │                                    │  (地圖、分享等)
        │                                    │
        │◄─── addEventListener('message')   │
        │      回傳處理結果                  │
        │                                    │
```

#### 實現原理

**Web 端發送訊息：**

```typescript
/**
 * 使用 useConnectionMessage composable 發送訊息到 Flutter
 * @param name - 訊息類型名稱，由雙方約定
 * @param data - 要發送的數據
 */
useConnectionMessage<T>(name: string, data: T)

// 實現原理
if (typeof flutterObject !== 'undefined' && flutterObject) {
  const postInfo = JSON.stringify({ name, data });
  flutterObject.postMessage(postInfo);
}
```

**Web 端接收訊息：**

```typescript
/**
 * 使用 useHandleConnectionData composable 監聽來自 Flutter 的訊息
 * @param cb - 回調函數，接收 MessageEvent
 */
useHandleConnectionData((event: { data: string }) => {
  const result = JSON.parse(event.data);
  // 處理 Flutter 的回應
})
```

**Flutter 端配置（示意）：**

```dart
// 在 flutter_inappwebview 中配置 WebMessageListener
webViewController.addWebMessageListener(
  WebMessageListener(
    jsObjectName: "flutterObject",  // 與 Web 端對應
    allowedOriginRules: {"*"},
    onPostMessage: (message, origin) async {
      // 接收並處理來自 Web 的訊息
      final data = jsonDecode(message as String);
      final messageName = data['name'] as String;
      final messageData = data['data'];
      
      // 根據 messageName 執行相應操作
      if (messageName == 'launch_map') {
        // 打開地圖
      } else if (messageName == 'share') {
        // 分享功能
      }
      
      // 回傳結果
      await webViewController.postWebMessage(
        WebMessage(data: jsonEncode({'success': true}))
      );
    },
  )
);
```

---

## Data Model 定義

### 訊息框架結構

所有 Web ◄-► Native 的通訊都遵循統一的 JSON 訊息格式。

#### 發送訊息格式 (Web → Native)

```typescript
interface FlutterMessage<T = any> {
  /** 訊息類型/操作名稱 */
  name: string;
  /** 訊息承載的數據 */
  data: T;
}

// JSON 序列化後的形式
{
  "name": "launch_map",
  "data": "https://maps.google.com/?q=台北市信義路"
}
```

#### 回應訊息格式 (Native → Web)

```typescript
interface FlutterMessageResponse<T = any> {
  /** 訊息類型/操作名稱 */
  name: string;
  /** 操作結果 */
  data: T;
}

// JSON 序列化後的形式
{
  "name": "launch_map",
  "data": false  // true: 已由原生處理, false: 需要 Web 備用處理
}
```

### 已定義的訊息類型

#### 1. **launch_map** - 啟動地圖應用

**發送方向：** Web → Native

**數據結構：**
```typescript
// 發送
{
  "name": "launch_map",
  "data": string  // Google Maps URL 或地址
}

// 回應
{
  "name": "launch_map",
  "data": boolean  // true: 成功打開原生地圖應用
                   // false: 原生層無法處理，Web 側應在新標籤頁開啟
}
```

**使用示例：**
```typescript
// CouponDetail.vue
const handleLaunchMap = (event: { data: string }) => {
  const result: { name: string; data: boolean } = JSON.parse(event.data);
  
  if (!result.data) {
    // 原生層無法處理，開啟瀏覽器
    window.open(couponItem.value?.store_info.address.map, '_blank');
  }
};

useHandleConnectionData(handleLaunchMap);

// 觸發地圖打開
useConnectionMessage('launch_map', couponItem.value?.store_info.address.map);
```

#### 2. **share** - 分享功能

**發送方向：** Web → Native

**數據結構：**
```typescript
interface ShareData {
  title: string;      // 分享標題
  text?: string;      // 分享文本
  url?: string;       // 分享 URL
}

// 訊息格式
{
  "name": "share",
  "data": {
    "title": "分享此優惠券",
    "text": "限時優惠，趕快來領取！",
    "url": "https://tp.dstw.dev/coupon/123"
  }
}

// 回應
{
  "name": "share",
  "data": boolean  // true: 成功調用原生分享
                   // false: 原生層無法處理
}
```

#### 3. 其他待定義訊息類型

可根據需要擴展以下訊息類型：

- **notification** - 推送通知
- **camera** - 相機掃描 QR Code
- **share_file** - 分享文件
- **app_event** - 應用層級事件
- **user_auth** - 用戶認證信息
- **location** - 位置服務

### Web 側數據模型示例

#### Fee Payment 規費繳納

```typescript
interface FeePayment {
  id: string;
  /** 繳費類別 */
  name: string;
  /** 是否為熱門項目 */
  is_hot: boolean;
  /** 查詢類別頁籤 */
  search_type_list: SearchType[];
}

interface SearchType {
  name: string;
  type: string;
  form_format: Record<string, any>[];
  /** 注意事項 */
  notice?: string[];
}
```

#### 帳單資訊

```typescript
interface Bill {
  id: string;
  amount: number;
  dueDate: string;
  status: 'unpaid' | 'paid' | 'overdue';
  description: string;
}
```

#### 繳費紀錄

```typescript
interface PaymentHistory {
  id: string;
  date: string;
  amount: number;
  method: string;
  status: 'pending' | 'completed' | 'failed';
}
```

---

## 系統構成

### 前端應用 (`/frontend`)

Vue 3 + TypeScript 開發的 SPA 應用，運行在 Flutter WebView 中。

**主要模塊：**

```
frontend/src/
├── components/          # Vue 組件（原子化設計）
│   ├── atoms/          # 基礎組件（按鈕、輸入框等）
│   ├── molecules/      # 複合組件（表單、卡片等）
│   └── organisms/      # 頁面級組件（導航、列表等）
├── views/              # 頁面級組件
├── composables/        # Vue Composables
│   ├── useConnectionMessage.ts      # 發送訊息給 Flutter
│   └── useHandleConnectionData.ts   # 監聽 Flutter 訊息
├── stores/             # Pinia 狀態管理
├── router/             # Vue Router 配置
├── interfaces/         # TypeScript 介面定義
├── utils/              # 工具函數
├── assets/             # 靜態資源
└── css/                # 樣式表
```

**關鍵特性：**
- ✅ TypeScript 類型安全
- ✅ Tailwind CSS 樣式
- ✅ Google Maps 集成
- ✅ QR Code 生成
- ✅ 狀態管理 (Pinia)
- ✅ 路由管理 (Vue Router)
- ✅ Flutter WebView 通訊

### 後端服務 (`/backend`)

Node.js + Fastify 構建的 RESTful API 服務。

**主要結構：**

```
backend/src/
├── app.js              # 應用入口
├── routes/             # API 路由
│   ├── health.routes.js      # 健康檢查
│   └── docs.routes.js        # API 文檔
└── services/           # 業務邏輯層
    └── database.service.js   # 數據庫連接
```

**服務特性：**
- ✅ 高性能 Fastify 框架
- ✅ 健康檢查端點
- ✅ CORS 支持
- ✅ API 文檔 (Swagger)
- ✅ 資料庫連接池
- ✅ 日誌記錄

### 數據庫 (`/data`)

MariaDB 11 數據庫實例，管理所有持久化數據。

---

## 快速開始

### 環境準備

**必需：**
- Docker & Docker Compose
- Node.js 22+
- pnpm 或 npm

### 開發環境啟動

1. **克隆項目並配置環境變數：**

```bash
git clone <repository-url>
cd townpass-micro-service-2026

# 複製環境文件
cp .env.example .env

# 編輯 .env，設置必需的環境變數
# MYSQL_DATABASE=townpass
# MYSQL_USER=townpassuser
# MYSQL_PASSWORD=<your-password>
# MYSQL_ROOT_PASSWORD=<root-password>
# VITE_API_BASE_URL=http://localhost:3001
```

2. **啟動開發容器：**

```bash
docker-compose up -d
```

此命令會啟動：
- **dev-frontend**: Vue 3 開發伺服器 (Vite) - http://localhost:3000
- **dev-backend**: Node.js API 伺服器 - http://localhost:3001
- **dev-db**: MariaDB 數據庫 - localhost:3306
- **adminer**: 數據庫管理工具 - http://localhost:3002

3. **安裝前端依賴（如需）：**

```bash
cd frontend
pnpm install
pnpm dev
```

4. **安裝後端依賴（如需）：**

```bash
cd backend
npm install
npm run dev
```

### 生產環境部署

使用 `docker-compose.prod.yaml` 進行生產部署：

```bash
docker-compose -f docker-compose.prod.yaml up -d
```

---

## API 文檔

### 健康檢查

檢查服務和數據庫狀態。

**端點：**
```
GET /health
GET /
```

**回應示例：**
```json
{
  "status": "ok"
}
```

**錯誤回應：**
```
Status: 503 Service Unavailable
{
  "status": "unavailable"
}
```

### CORS 配置

後端使用 `@fastify/cors` 處理跨域請求。

**允許的來源：** 由環境變數 `CORS_ALLOWED_ORIGINS` 定義（預設為 `http://localhost:3000,http://localhost:5173`）

**允許的方法：** GET, POST, PUT, DELETE, PATCH, OPTIONS

**允許的標頭：** Authorization, Content-Type

---

## 開發指南

### 前端開發

#### 使用 Flutter WebView 通訊

1. **發送訊息到 Flutter：**

```typescript
// 在 View 中導入
import { useConnectionMessage } from '@/composables/useConnectionMessage';

// 發送訊息
useConnectionMessage('launch_map', mapUrl);
```

2. **監聽 Flutter 回應：**

```typescript
// 在 View 中導入
import { useHandleConnectionData } from '@/composables/useHandleConnectionData';

// 監聽訊息
useHandleConnectionData((event: { data: string }) => {
  const response = JSON.parse(event.data);
  console.log('Flutter 回應:', response);
});
```

#### 添加新的訊息類型

1. 在適當的 View 中定義訊息發送邏輯
2. 在 Flutter 端配置 WebMessageListener 處理
3. 更新本 README 的 Data Model 部分

#### 最佳實踐

✅ **建議做法：**
- 在 `/views` 目錄的頁面級組件中呼叫 Flutter 通訊
- 每個頁面只監聽一次訊息（避免重複創建監聽器）
- 使用 TypeScript 介面定義訊息結構

❌ **避免做法：**
- 在 `/components` 子組件中呼叫 Flutter 通訊
- 多次創建相同的訊息監聽器
- 不進行類型檢查的訊息解析

### 後端開發

#### 添加新的 API 路由

1. 在 `/backend/src/routes/` 建立新的路由文件
2. 使用 Fastify 框架定義端點
3. 在 `app.js` 中註冊路由

**路由範例：**

```javascript
export default async function userRoutes(app) {
  app.get("/users/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      const [rows] = await app.db.query(
        "SELECT * FROM users WHERE id = ?",
        [id]
      );
      return { data: rows[0] };
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  });
}
```

#### 數據庫連接

後端使用 MySQL2 連接池管理數據庫連接。

```javascript
// 在路由中使用
const [rows] = await app.db.query(
  "SELECT * FROM table WHERE id = ?",
  [id]
);
```

### 代碼風格

**前端：**
- ESLint + Prettier 自動格式化
- 運行 `pnpm lint` 檢查代碼
- 運行 `pnpm format` 格式化代碼

**後端：**
- 遵循 Node.js 最佳實踐
- 使用 const/let（避免 var）
- 異步函數使用 async/await

### 測試

**運行前端測試：**
```bash
cd frontend
pnpm test
```

**運行後端測試：**
```bash
cd backend
npm test
```

---

## 部署

### Docker 構建

**前端構建：**
```bash
docker build -f frontend/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.tp.dstw.dev \
  -t townpass-frontend:latest \
  frontend/
```

**後端構建：**
```bash
docker build -f backend/Dockerfile \
  -t townpass-backend:latest \
  backend/
```

### 環境變數

**關鍵環境變數：**

| 變數名                    | 說明                        | 示例                          |
|-----------------------|---------------------------|-------------------------------|
| CORS_ALLOWED_ORIGINS | 允許的跨域來源             | http://localhost:3000,http://localhost:5173 |
| MYSQL_DATABASE       | 數據庫名稱                | townpass                      |
| MYSQL_USER           | 數據庫用戶                | townpassuser                  |
| MYSQL_PASSWORD       | 數據庫密碼                | (自定義)                      |
| MYSQL_ROOT_PASSWORD  | 數據庫 root 密碼           | (自定義)                      |
| VITE_API_BASE_URL    | 前端調用的 API 基礎 URL    | https://api.tp.dstw.dev      |
| APP_BASE_URL         | 應用公開 URL              | https://tp.dstw.dev          |

---

## 故障排查

### Web 無法連接到 Flutter

**問題：** `window.flutterObject` 未定義

**解決方案：**
1. 確認代碼運行在 Flutter WebView 中
2. 檢查 Flutter 端是否正確配置了 WebMessageListener
3. 查看瀏覽器控制台的錯誤信息

### 訊息未被接收

**問題：** 發送的訊息沒有回應

**解決方案：**
1. 確認訊息格式正確（JSON 序列化）
2. 檢查 Flutter 端是否註冊了該訊息類型的監聽器
3. 查看 Native 層日誌

### 數據庫連接失敗

**問題：** 健康檢查返回 503

**解決方案：**
1. 確認容器已完全啟動：`docker-compose ps`
2. 檢查數據庫日誌：`docker-compose logs dev-db`
3. 驗證數據庫憑證在 `.env` 中正確設置

---

## 貢獻指南

1. 創建特性分支：`git checkout -b feature/your-feature`
2. 提交變更：`git commit -am 'Add feature'`
3. 推送到遠端：`git push origin feature/your-feature`
4. 提交 Pull Request

---

## 許可證

[待定義]

---

## 聯絡方式

- 項目維護者：城市通開發團隊
- 文檔最後更新：2026-11-07

---

## 相關資源

- [flutter_inappwebview 文檔](https://inappwebview.dev/)
- [Vue 3 文檔](https://vuejs.org/)
- [Fastify 文檔](https://www.fastify.io/)
- [Tailwind CSS 文檔](https://tailwindcss.com/)
- [MySQL2 文檔](https://github.com/sidorares/node-mysql2)
- [Pinia 文檔](https://pinia.vuejs.org/)
