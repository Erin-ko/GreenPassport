from pydantic import BaseModel, Field
from datetime import datetime
from app.schemas.comment import CommentResponse

class CommunityPostCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100, description="募集標題")
    item_type: str = Field(..., min_length=1, max_length=50, description="零件或物品類別")
    content: str = Field(..., min_length=10, max_length=1000, description="詳細內容，至少 10 字元")
    approx_location: str | None = Field(None, max_length=100, description="發文時的約略定位座標")
    post_type: str = Field("Request", description="貼文類型：Request/Trade")
    price_or_condition: str | None = Field(None, max_length=200, description="價格或交換條件")
    price: float | None = Field(0.0, description="二手物品價格數值")
    item_health: int | None = Field(100, description="二手物品健康度")
    item_carbon: float | None = Field(0.0, description="物品預估碳排")
    image_data: str | None = Field(None, description="上傳貼文相片 Base64 數據")

class CommunityPostResponse(BaseModel):
    id: int
    user_id: int
    username: str
    title: str
    item_type: str
    content: str
    status: str
    post_type: str
    price_or_condition: str | None
    price: float | None = 0.0
    item_health: int | None = 100
    item_carbon: float | None = 0.0
    image_data: str | None = None
    created_at: datetime
    distance_text: str | None = None
    comments: list[CommentResponse] = []

    class Config:
        from_attributes = True  # Pydantic v2 ORM 轉換
