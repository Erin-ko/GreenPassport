# AI 開發代理與開發者共同規範 (AGENTS.md)

本文件定義了「綠色循環經濟護照 (Green Cycle Passport)」專案的架構規範、資安防護與開發協作準則。所有 AI 工具與開發人員皆須嚴格遵守。

## 1. 核心技術棧與架構
- **前端 (Frontend)**：純 HTML/CSS/JS (Vanilla MPA)，使用 CSS 進行 RWD 響應式佈局，需適配行動裝置與桌面端。
- **後端 (Backend)**：FastAPI (Python 3.10+)，使用 Uvicorn 作為運行伺服器。
- **資料庫 (Database)**：
  - 本地開發/測試環境：SQLite (檔案型資料庫)
  - 正式生產環境：Render PostgreSQL
- **部署平台**：Render.com (免費 Web Service 方案)
- **前後端部署與託管優化**：前端靜態目錄（`frontend/` 目錄）直接由後端 FastAPI 透過 `StaticFiles` 進行託管，以便在 Render 上以單一 Web Service 運行。

## 2. 資訊安全與憑證管理規範 (Critical!)
> [!IMPORTANT]
> **嚴禁將任何機密憑證硬編碼於程式中，或提交至 Git 儲存庫。**

### 2.1 機密防護
- **禁止項目**：不可硬編碼或提交 any API Key、密碼、Token、資料庫連線字串、加密 Secret。
- **解決方案**：所有敏感設定必須使用環境變數。後端使用 `pydantic-settings` 讀取環境變數。
- **本地設定**：建立 `.env` 檔案存放敏感變數。該檔案**必須**列入 `.gitignore`，嚴禁提交。
- **範例設定**：提供 `.env.example` 說明專案執行所需的環境變數，包含：
  - `DATABASE_URL` (資料庫連線字串)
  - `JWT_SECRET` (JWT 簽章密鑰)
  - `ACCESS_TOKEN_EXPIRE_MINUTES` (Token 有效時間)

### 2.2 敏感資料處理
- 使用者密碼寫入資料庫前，後端必須使用 `bcrypt` 進行單向雜湊加密 (`password_hash`)。
- 使用者位置僅儲存模糊化坐標（小數點後 2 位），API 傳輸時只輸出計算後的相對距離文字（例如：「距離 500m」），不得輸出經緯度。

## 3. Git 提交規範
- 提交前必須確保 `.env` 沒有被追蹤。
- Git Commit Message 格式建議：
  - `feat: [簡短描述]` - 新增功能
  - `fix: [簡短描述]` - 修補 Bug
  - `docs: [簡短描述]` - 僅修改文件
  - `refactor: [簡短描述]` - 重構程式碼

## 4. 目錄結構規範
```text
Passport/
├── doc/                    # 設計文件目錄
│   ├── requirements.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── project-memory.md
│   └── todo.md
├── backend/                # FastAPI 後端目錄
│   ├── app/
│   │   ├── models/         # SQLAlchemy Models
│   │   ├── schemas/        # Pydantic Schemas
│   │   ├── routers/        # API 路由
│   │   ├── core/           # 設定與安全 (config.py, security.py)
│   │   └── main.py         # 進入點 (並掛載靜態檔案目錄)
│   ├── alembic/            # 資料庫遷移
│   ├── requirements.txt
│   └── .env
├── frontend/               # 純 HTML 前端目錄
│   ├── css/
│   │   └── style.css       # 全域 RWD 樣式檔
│   ├── js/
│   │   └── main.js         # 前端 API 互動邏輯
│   ├── index.html          # 登入與註冊頁面 (首頁)
│   ├── passport.html       # 物品護照收藏庫與提醒
│   └── board.html          # 微型零件募集看板
├── .env.example
├── .gitignore
├── AGENTS.md
└── CLAUDE.md
```
