# 專案待辦清單 (Project TODO List)

本清單列出了「綠色循環經濟護照 (Green Cycle Passport)」Demo 原型系統的待開發需求、相依關係與驗收條件，並依優先級排序。

> [!WARNING]
> 未確認之需求（處於待確認狀態者）不可直接開發，狀態標示為「待確認」。

---

## 待開發項目 (依優先級與相依性排序)

### 1. 基礎架構與認證 (高優先級)

#### [x] [TODO-01] 專案結構初始化與環境設定
- **狀態**：`Done`
- **優先級**：高
- **相依關係**：無
- **驗收條件**：
  - [x] 建立 `backend` 與 `frontend` 的基本目錄與設定。
  - [x] 後端成功使用 Uvicorn 啟動 FastAPI 服務，並能直接託管並 Serving 前端靜態目錄（包含 `index.html`）。

#### [x] [TODO-02] 資料庫模型與 ORM 初始化
- **狀態**：`Done`
- **優先級**：高
- **相依關係**：`TODO-01`
- **驗收條件**：
  - [x] 使用 SQLAlchemy 定義 `User`、`ItemPassport`、`MaintenanceRecord` 與 `CommunityPost` 的 Table Schema。
  - [x] 設定 Alembic，能成功在本機 SQLite 執行 initial migration，且生成實體 Table。

#### [x] [TODO-03] 使用者註冊與 JWT 登入 API
- **狀態**：`Done`
- **優先級**：高
- **相依關係**：`TODO-02`
- **驗收條件**：
  - [x] 實作 `POST /api/auth/register`，驗證密碼強度（>=8字元）與 Email 格式，並使用 bcrypt 進行密碼雜湊。
  - [x] 實作 `POST /api/auth/login`，驗證密碼正確後，簽發並返回 JWT Token。
  - [x] 提供取得目前登入使用者資料的依賴注入（Dependency Injection）。

---

### 2. 物品護照核心功能 (高~中優先級)

#### [x] [TODO-04] 物品護照管理 (CRUD) API
- **狀態**：`Done`
- **優先級**：高
- **相依關係**：`TODO-03`
- **驗收條件**：
  - [x] 實作 `POST /api/items` 建立新護照，欄位包含照片（Base64 暫存且限制大小 < 500KB）、名稱、材質、購買日期、預估壽命與提醒週期。
  - [x] 實作 `GET /api/items` 取得當前登入使用者的所有物品清單。
  - [x] 實作 `GET /api/items/{id}` 取得單一物品詳細資料，並回傳碳排預估與循環建議（二手估價、回收、捐贈管道）。
  - [x] 實作 `DELETE /api/items/{id}` 軟刪除物品護照（將狀態標示為 Recycled/Donated/Sold）。

#### [x] [TODO-05] 維修保養紀錄 API
- **狀態**：`Done`
- **優先級**：中
- **相依關係**：`TODO-04`
- **驗收條件**：
  - [x] 實作 `POST /api/items/{id}/maintenance` 新增維修紀錄（包含維修日期、內容與花費）。
  - [x] 寫入維修紀錄後，自動更新該物品護照的維修歷程與最新健康度。

#### [x] [TODO-06] 物品護照與提醒 HTML 網頁開發
- **狀態**：`Done`
- **優先級**：中
- **相依關係**：`TODO-04`
- **驗收條件**：
  - [x] 建立 `frontend/passport.html` 網頁。
  - [x] 前端實作利用 Vanilla JS 串接 `GET /api/items` 展示個人物品收藏庫。
  - [x] 提供物品登錄與維修紀錄填寫表單，支援選擇本地照片並在前端限制大於 500KB 的檔案上傳。
  - [x] 前端實作登入時向 `/api/items/reminders` 查詢，並在畫面上以 modal 跳窗顯示保養提醒。

---

### 3. 社群互助與 UI 美化 (中~低優先級)

#### [x] [TODO-07] 註冊與登入 HTML 網頁開發
- **狀態**：`Done`
- **優先級**：中
- **相依關係**：`TODO-03`
- **驗收條件**：
  - [x] 建立 `frontend/index.html` 網頁。
  - [x] 提供註冊/登入表單，具備基本的 Email 與密碼長度驗證。
  - [x] 登入成功後，將 JWT Token 寫入 `localStorage`，並自動跳轉至 `passport.html`。

#### [x] [TODO-08] 微型零件募集看板 API (位置隱私保護)
- **狀態**：`Done`
- **優先級**：中
- **相依關係**：`TODO-03`
- **驗收條件**：
  - [x] 實作 `POST /api/board/posts` 發布零件募集貼文（儲存粗略郵遞區號或兩位小數的經緯度）。
  - [x] 實作 `GET /api/board/posts` 取得鄰近募集清單，後端使用 Haversine 計算距離，回傳給前端的資料必須模糊化（只顯示「X 公里內」），不能流出發文者座標。

#### [x] [TODO-09] 互助看板 HTML 網頁開發
- **狀態**：`Done`
- **優先級**：低
- **相依關係**：`TODO-08`
- **驗收條件**：
  - [x] 建立 `frontend/board.html` 網頁。
  - [x] 前端使用 JS 串接募集看板 API，列出鄰近貼文，展示模糊距離（如「距離 500m」）。
  - [x] 提供發布募集零件的表單，支援手動選擇粗略區域或取得瀏覽器 GPS 定位。

---

### 4. 部署與整合 (低優先級)

#### [x] [TODO-10] Render.com 雲端部署
- **狀態**：`Done`
- **優先級**：低
- **相依關係**：`TODO-06`, `TODO-09`
- **驗收條件**：
  - [x] 後端靜態目錄 serving 設定無誤，且 Render PostgreSQL 連線測試正常。
  - [x] 將專案 Push 至 GitHub，於 Render.com 部署單一 Web Service 服務並測試冷啟動正常。

---

## 待確認事項 (暫不列入可開發項目)

#### [ ] [PENDING-01] 串接外部免費圖床 (Cloudinary)
- **狀態**：`待確認` (不進行開發)
- **說明**：由於 Base64 將佔用免費 PostgreSQL 資料庫容量，未來是否需註冊 Cloudinary 免費帳號，改採 API 上傳圖片並存 URL？
- **驗收條件**：待使用者確定後再行規劃。

#### [ ] [PENDING-02] 外部主動發信提醒 (LINE Notify / Email)
- **狀態**：`待確認` (不進行開發)
- **說明**：為解決 Render 休眠無法主動提醒問題，未來是否需結合 `cron-job.org` 喚醒 API 並使用免費 `SendGrid` API 發送 Email，或串接 `LINE Notify`？
- **驗收條件**：待使用者確定後再行規劃。
