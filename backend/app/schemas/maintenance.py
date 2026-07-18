from pydantic import BaseModel, Field
from datetime import date
from app.schemas.item import MaintenanceRecordResponse

class MaintenanceRecordCreate(BaseModel):
    maintenance_date: date = Field(..., description="維修保養日期")
    description: str = Field(..., min_length=5, max_length=500, description="維修項目描述，至少 5 字元")
    cost: float = Field(0.0, ge=0.0, description="維修保養費用，必須大於等於 0")
    notes: str | None = Field(None, max_length=1000, description="備註資訊")
