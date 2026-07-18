from pydantic import BaseModel, Field, model_validator
from datetime import date, datetime

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="物品名稱")
    material: str | None = Field(None, max_length=100, description="主要材質")
    purchase_date: date = Field(..., description="購買日期")
    estimated_expiry: date = Field(..., description="預估壽命到期日")
    reminder_interval_days: int = Field(30, gt=0, description="保養提醒間隔天數")
    image_data: str | None = Field(None, description="圖片 Base64 數據")
    category: str | None = Field(None, max_length=50, description="物品分類")

    @model_validator(mode='after')
    def validate_dates_and_image(self) -> 'ItemCreate':
        # 1. 驗證日期前後順序
        if self.estimated_expiry <= self.purchase_date:
            raise ValueError('預估壽命到期日期必須晚於購買日期')
            
        # 2. 驗證圖片大小 (限制 Base64 長度 700,000 字元，相當於約 500KB 的圖片檔案)
        if self.image_data and len(self.image_data) > 700000:
            raise ValueError('上傳圖片檔案大小不能超過 500KB')
            
        return self

class ItemResponse(BaseModel):
    id: int
    user_id: int
    name: str
    material: str | None
    category: str | None = None
    image_data: str | None = None
    purchase_date: date
    estimated_expiry: date
    reminder_interval_days: int
    health_status: str
    created_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2 ORM 轉換

class CircularAdvice(BaseModel):
    carbon_emissions: str
    resale_estimate: str
    donation_channel: str
    recycling_category: str

class MaintenanceRecordResponse(BaseModel):
    id: int
    item_passport_id: int
    maintenance_date: date
    description: str
    cost: float
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True

class ItemDetailResponse(ItemResponse):
    image_data: str | None
    circular_advice: CircularAdvice | None = None
    records: list[MaintenanceRecordResponse] = []

class ESGPointsDetail(BaseModel):
    name: str
    action: str
    detail: str | None = None
    points: int

class ESGCarbonDetail(BaseModel):
    name: str
    action: str
    carbon: float

class ESGPostHistory(BaseModel):
    title: str
    post_type: str
    status: str
    date: str

class ESGCircularDetail(BaseModel):
    name: str
    action: str
    material: str | None = None
    category: str | None = None
    date: str

class ESGStatsResponse(BaseModel):
    total_points: int
    total_carbon_saved: float
    maintenance_count: int
    active_count: int
    recycled_count: int
    donated_count: int
    sold_count: int
    discarded_count: int
    points_detail: list[ESGPointsDetail] = []
    carbon_detail: list[ESGCarbonDetail] = []
    post_history: list[ESGPostHistory] = []
    circular_detail: list[ESGCircularDetail] = []
