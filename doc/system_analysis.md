# LifeCycle Passport 系統架構與資料流分析報告

本報告針對 [LifeCycle Passport - 家庭循環資產履歷與 ESG 減碳管家](https://life-cycle-passport.vercel.app/) 的網頁功能、系統架構及資料流進行深度解析，並結合專案本地 `FastAPI` + `Vanilla MPA` 設計，探討在 Demo 階段與正式生產環境中的系統實現。

---

## 1. 網頁功能模組剖析

從線上網頁的結構來看，系統共分為六大核心功能模組：
1. **家庭減碳度量儀表板 (Dashboard)**：統計並展示使用者的資產總量、預期壽命、累計減碳量（kg CO₂）及循環行動次數。
2. **我的資產庫 (Asset Library)**：管理家庭中 3C 家電、家具、交通工具等物品 of 數位履歷（折舊、健康狀態、維護進度），並提供狀態與類別篩選。
3. **啟動新護照 (Register Item)**：登記新物品的基本資料（名稱、材質、年限、購買日），並可點擊「AI 自動分析與填補」以生成預估碳足跡與維護指南。
4. **社區物資共享 (Community Sharing)**：提供鄰里間的零件募集（如單個螺絲）、物品借用與二手贈送。
5. **聊聊 (Chat)**：用戶針對共享物資或互助募集進行點對點即時溝通。
6. **永續減碳報告 (ESG Report)**：將循環行動（保養、維修、捐贈）節省的碳排具體化（如等同種植多少棵樹），並設有「永續成就勳章」解鎖與歷史日誌。

---

## 2. 系統整體架構 (System Architecture)

此系統存在兩種架構層面的實現：
*   **展示模式 (Client-Side LocalStorage)**：即目前的 Vercel 部署版，所有資料直接儲存在瀏覽器 `localStorage` 中，適合無伺服器冷啟動延遲的 Demo 展示。
*   **生產模式 (Full-Stack Client-Server)**：結合 FastAPI 後端與關係型資料庫的標準架構，實現跨裝置同步與社區共享的即時通訊。

### 2.1 系統架構圖 (System Architecture Diagram)

```mermaid
graph TD
    subgraph Client ["客戶端 (Web App)"]
        NextJS["Next.js / React 前端 (Vercel)"]
        UI["多頁面/組件化 RWD 介面"]
        State["前端狀態管理 (React State & Context)"]
        LStore[("本地瀏覽器 LocalStorage <br/>(Demo 模式下存儲展示資產、貼文、聊聊資料)")]
    end

    subgraph Server ["後端服務 (FastAPI / Render)"]
        API["FastAPI 路由控制器 (RESTful / WebSocket)"]
        AuthSrv["認證服務 (JWT Passlib Bcrypt)"]
        PassportSrv["護照管理與 AI 估算邏輯"]
        CarbonSrv["ESG 碳排換算與成就模組"]
        GeoSrv["模糊地理計算 (Haversine 距離)"]
        ChatSrv["即時通訊服務 (WebSockets)"]
        ORM["SQLAlchemy ORM"]
    end

    subgraph DB_Layer ["資料存儲層"]
        DB[("PostgreSQL (生產環境) <br/> SQLite (本地開發)")]
        ImgStore["外部免費圖床 (如 Cloudinary) <br/> 或 Base64 欄位限制 (500KB 以下)"]
    end

    NextJS --> UI
    UI <--> State
    State <-->|Demo 模式讀寫| LStore

    UI <-->|HTTPS / REST API / WSS| API
    API --> AuthSrv
    API --> PassportSrv
    API --> CarbonSrv
    API --> GeoSrv
    API --> ChatSrv
    
    AuthSrv & PassportSrv & CarbonSrv & GeoSrv & ChatSrv --> ORM
    ORM <--> DB
    PassportSrv -.->|圖片處理| ImgStore
```

### 架構層次說明：
1.  **客戶端 (Client)**：
    *   **Vercel 部署版**採用 Next.js，支援快速的 UI 渲染與組件化。
    *   **本機開發版**採用極簡的 Vanilla MPA (HTML/CSS/JS)，以靜態目錄託管於 FastAPI 下，降低維護門檻。
2.  **本地存儲 (LocalStorage)**：在 Demo 模式下，載入展示資料與重置均在客戶端完成，不依賴後端。
3.  **後端服務 (FastAPI)**：負責邏輯與資料庫互動。
4.  **資料存儲**：SQLite 用於本地輕量開發，PostgreSQL 用於正式上線。圖片因資料庫容量限制採用 Base64 格式 (限 500KB 以下) 或外部免費圖床。

---

## 3. 核心業務資料流 (Data Flows)

### 3.1 物品護照登記與 AI 碳排評估資料流

當使用者在 `/register` 頁面登記新物品並請求 AI 分析時，資料流向如下：

```mermaid
sequenceDiagram
    actor User as 使用者
    participant FE as 前端瀏覽器 (Next.js / Vanilla)
    participant BE as FastAPI 後端
    participant DB as 資料庫

    User->>FE: 輸入物品資料 (名稱、材質、年限)
    User->>FE: 點擊「AI 自動分析與填補」
    FE->>BE: POST /api/items/analyze (傳送物品名稱、材質)
    Note over BE: 1. 解析材質屬性<br/>2. 計算生命週期預估製造碳排放<br/>3. 比對資料庫，取得保養週期與壽命建議
    BE-->>FE: 回傳分析預估數據 (碳排 kg, 預期壽命, 建議保養項目)
    FE-->>User: 畫面動態填補、更新 AI 估計值
    
    User->>FE: 確認資料無誤，點擊「啟動護照」
    FE->>BE: POST /api/items (附帶 JWT Token & 物品資料 & 照片 Base64)
    Note over BE: 驗證 JWT、限制圖片大小 < 500KB、產生折舊公式
    BE->>DB: 寫入 ItemPassport 實體
    DB-->>BE: 寫入成功
    BE-->>FE: 回傳 201 Created (物品護照詳細資料)
    FE-->>User: 跳轉回資產庫頁面，更新儀表板與狀態
```

---

### 3.2 循環行動（維修、保養）與 ESG 報告更新資料流

使用者對物品進行保養或維修，以延長壽命並即時更新永續減碳報告：

```mermaid
sequenceDiagram
    actor User as 使用者
    participant FE as 前端瀏覽器 (Next.js / Vanilla)
    participant BE as FastAPI 後端
    participant DB as 資料庫

    User->>FE: 選定特定物品，點擊「登記維護/保養紀錄」
    FE->>BE: POST /api/items/{id}/maintenance (維護內容、費用)
    Note over BE: 1. 更新物品健康度 (如 回復至 100%)<br/>2. 根據物品類別延長其預估使用壽命
    BE->>DB: 更新 ItemPassport 狀態 & 寫入 MaintenanceRecord
    DB-->>BE: 寫入成功
    
    Note over BE: 3. 計算此次延壽所節省的「碳排放替代量」<br/>(替代量 = 新品製造碳排 * 延長壽命比例)<br/>4. 更新使用者的累計減碳總量
    BE->>DB: 更新 User.cumulative_co2_saved 數值
    DB-->>BE: 寫入成功
    
    BE-->>FE: 回傳更新後的物品與最新減碳數值
    FE->>BE: GET /api/report (查詢減碳報告與成就)
    BE->>DB: 查詢減碳總量，比對成就解鎖條件 (例如 > 10kg)
    Note over BE: 解鎖成就「重生導師」、「綠色萌芽」...
    BE-->>FE: 回傳減碳報告 (含折算樹木量、已解鎖勳章、成就進度)
    FE-->>User: 顯示綠色永續報告，解鎖新成就動畫
```

---

### 3.3 社區物資共享與位置隱私模糊化資料流

看板共享時，必須保障使用者精確住址隱私，距離計算採後端 Haversine 計算，API 模糊化傳遞：

```mermaid
sequenceDiagram
    actor Owner as 募集者 (有多餘零件/欲出借)
    actor Viewer as 瀏覽者 (鄰近鄰居)
    participant FE as 前端瀏覽器 (Next.js)
    participant BE as FastAPI 後端
    participant DB as 資料庫

    Owner->>FE: 填寫募集/出借貼文 (含粗略郵區或點擊 GPS 定位)
    Note over FE: 瀏覽器 GPS 取得高精度座標 (e.g. 25.034567, 121.564567)
    FE->>BE: POST /api/board/posts (附帶經緯度座標 & 貼文內容)
    Note over BE: 1. 座標小數點後第3位以下四捨五入 (模糊至小數後2位，約 1.1 km 誤差)<br/>2. 儲存模糊化座標
    BE->>DB: 寫入 CommunityPost (含模糊經緯度)
    DB-->>BE: 儲存成功
    BE-->>Owner: 貼文發布成功

    Note over Viewer: 開啟社區共享牆 (/sharing)
    Viewer->>FE: 請求周邊貼文 (提供 Viewer 當前模糊位置)
    FE->>BE: GET /api/board/posts?lat=25.04&lon=121.57
    BE->>DB: 查詢所有有效互助貼文
    Note over BE: 3. 利用 Haversine 公式計算 Owner 與 Viewer 模糊座標的距離 d<br/>4. 將精確/模糊座標自 API 欄位中剔除<br/>5. 僅輸出文字：「距離約 {d} m/km」或「同社區」
    BE-->>FE: 回傳貼文清單 (隱藏座標，僅保留相對距離文字)
    FE-->>Viewer: 渲染共享牆，貼文顯示「距離約 500m」，安全保護隱私
```

---

### 3.4 即時聊聊與共享確認資料流

鄰里雙方透過聊聊協商，並在確認出借或贈送後，自動轉換物品履歷：

```mermaid
sequenceDiagram
    actor Owner as 物品擁有者
    actor Borrower as 借用人
    participant FE as 瀏覽器 (WebSockets)
    participant BE as FastAPI (WebSocket / ChatSrv)
    participant DB as 資料庫

    Borrower->>FE: 在貼文頁點擊「聊聊」並傳送私訊
    FE->>BE: 通過 WebSocket 連線發送訊息 (含 PostID)
    Note over BE: 儲存對話紀錄，查找並路由給 Owner 的連線
    BE-->>FE: (Owner) 接收新訊息提示
    
    Owner->>FE: 與借用人完成協商，於聊聊中點擊「確認出借/贈送」
    FE->>BE: POST /api/board/posts/{id}/confirm (對象: Borrower)
    Note over BE: 1. 將看板貼文狀態更新為「已完成/結案」<br/>2. 變更物品所有權，或將該物品標記為「已出借/已轉售」
    BE->>DB: 更新 ItemPassport.status = "已出借/已捐贈"
    DB-->>BE: 寫入成功
    Note over BE: 3. 計算本次共享流轉之 ESG 碳排減免<br/>4. 更新雙方用戶的「循環行動次數」與「累計減碳量」
    BE->>DB: 更新 Owner 與 Borrower 的統計資料
    DB-->>BE: 寫入成功
    BE-->>FE: 廣播確認狀態至雙方
    FE-->>Owner & Borrower: 聊天室更新為「共享完成」，雙方減碳儀表板數值上升
```

---

## 4. 系統安全與隱私防護設計

網頁與後端系統在設計上納入了幾項關鍵的資訊安全與隱私防護措施：

1.  **位置隱私防護 (Location Obfuscation)**：
    *   *機制*：前端利用 HTML5 Geolocation API 取得精確 GPS，但在 API 發送或後端接收時，經緯度一律被模糊化至小數點後兩位（誤差約 1.1 公里），且資料庫**不儲存精確座標與詳細地址**。
    *   *傳輸安全*：API 輸出給大眾瀏覽時，徹底移除所有經緯度欄位，僅返回計算後的相對距離文字（例如：「距離 300 公尺」、「距離 1.2 公里」），防止逆向定位攻擊。
2.  **圖片上傳限制 (Base64 Ephemeral Storage)**：
    *   *機制*：為防止資料庫爆滿，上傳圖片限制在 500KB 以下，前端進行壓縮後以 Base64 字串傳送，並存放在關係型資料庫的 TEXT 欄位中，免去了複雜的外部物件存儲設定，又保證了在 Vercel/Render 免費硬碟重啟時資料不丟失。
3.  **無狀態認證 (Stateless JWT)**：
    *   *機制*：用戶密碼採用 `bcrypt` 單向雜湊加密存儲。認證使用 JWT，客戶端登入後將 Token 存於 `localStorage`，隨後的 API 請求於 Header 攜帶 `Authorization: Bearer <JWT>`，降低伺服器 Session 的維護負擔。

---

## 5. 一般使用者操作流程圖 (User Operations Flow)

本章節提供適合一般使用者（非技術人員）理解的整合性操作流程。本圖展示了「資產擁有者」與「物資需求者」如何透過「社區共享媒合牆」產生交集，完成資源流轉並共同實踐綠色生活的完整閉環。

```mermaid
graph TD
    %% 角色定義與起點
    subgraph OwnerFlow ["【資產擁有者流程】"]
        Start1(["購買新物品 <br/> 如沙發、單車"]) --> Register["登入系統登記物品<br/>可由 AI 輔助填寫"]
        Register --> Use["日常使用物品"]
        Use --> Alert{"收到保養提醒？"}
        
        Alert -- 是 --> Maintain["進行保養或送修<br/>在系統記錄維護"]
        Maintain --> Health["物品健康度回復<br/>延長壽命且省下新品碳排"]
        Health --> Use
        
        Alert -- 否 (想要汰換或閒置) --> Decision{"物品如何處置？"}
        Decision -->|需要專業回收/轉售| Recover["根據建議二手賣出或捐贈"]
    end

    subgraph BorrowerFlow ["【零件/工具需求者流程】"]
        Start2(["物品損壞少零件或需要工具<br/>如少螺絲、需要電鑽"]) --> Action{"選擇如何取得？"}
        Action -->|直接去賣場購買一包| Buy["增加花費且造成材料浪費"]
        Action -->|尋求社區協助| Post["在社區共享發布募集貼文<br/>系統會模糊定位保護隱私"]
    end

    %% 共同交會點：社區共享平台
    Decision -->|還可以正常使用| ShareBoard[["🤝 社區共享媒合牆"]]
    Post --> ShareBoard
    
    %% 媒合與結案流
    ShareBoard --> Match["雙方看到合適的貼文與物件"]
    Match --> Chat["在系統內開啟『聊聊』<br/>確認面交時間與地點"]
    Chat --> Handover["完成零件交割或物品借用"]
    Handover --> Repair["修復物品或完成工作"]
    Repair --> Confirm["點擊『確認結案』<br/>完成流轉狀態變更"]
    
    %% 共同終點
    Confirm --> Reward["雙方獲得減碳榮譽值與成就"]
    Recover --> Reward
    Reward --> End([實踐永續鄰里互助生活圈])

    style Start1 fill:#f9f,stroke:#333,stroke-width:1px
    style Start2 fill:#f9f,stroke:#333,stroke-width:1px
    style ShareBoard fill:#bbf,stroke:#333,stroke-width:2px
    style End fill:#9f9,stroke:#333,stroke-width:2px
    style Alert fill:#ff9,stroke:#333,stroke-width:1px
    style Decision fill:#ff9,stroke:#333,stroke-width:1px
    style Action fill:#ff9,stroke:#333,stroke-width:1px
```
