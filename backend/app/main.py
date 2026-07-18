import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.core.config import settings

from app.routers import auth, items, board, messages

from starlette.responses import Response

app = FastAPI(title="Green Cycle Passport API")

# 掛載會員認證、物品護照與募集看板路由器
app.include_router(auth.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(board.router, prefix="/api")
app.include_router(messages.router, prefix="/api")

# API 健康檢查端點 (未來會在此掛載各路由)
@app.get("/api")
def read_root():
    return {"status": "ok", "message": "Welcome to Green Cycle Passport API"}

# 動態定位前端靜態檔案目錄 (相對於 main.py 所在的 app 目錄的上一層的上一層)
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))

# 自訂不進行快取的 StaticFiles，以防止瀏覽器快取 HTML 導致新網址或選單無法顯示
class NoCacheStaticFiles(StaticFiles):
    def is_not_modified(self, response_headers, request_headers) -> bool:
        return False

    async def get_response(self, path: str, scope) -> Response:
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

if os.path.exists(frontend_dir):
    # 掛載靜態檔案，html=True 代表預設會尋找 index.html
    app.mount("/", NoCacheStaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    @app.get("/")
    def fallback_root():
        return {
            "status": "error", 
            "message": f"前端靜態目錄未找到，預期路徑為: {frontend_dir}"
        }
