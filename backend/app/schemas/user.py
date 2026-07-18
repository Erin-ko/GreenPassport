from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import re

# 電子信箱格式驗證正則表達式 (避免強制安裝 email-validator)
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50, description="使用者名稱")
    email: str = Field(..., max_length=100, description="電子信箱")
    password: str = Field(..., min_length=8, max_length=100, description="密碼，至少 8 碼")
    approx_location: str | None = Field(None, max_length=100, description="模糊定位位置")

    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_REGEX.match(v):
            raise ValueError('電子信箱格式不合法')
        return v

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    approx_location: str | None
    created_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2 用於將 SQLAlchemy ORM 轉換為 Pydantic Model

class Token(BaseModel):
    access_token: str
    token_type: str
    approx_location: str | None = None

class TokenData(BaseModel):
    email: str | None = None
