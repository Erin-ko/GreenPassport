from pydantic import BaseModel, Field
from datetime import datetime

class MessageCreate(BaseModel):
    recipient_id: int = Field(..., description="接收者使用者ID")
    post_id: int | None = Field(None, description="關聯的募集或交易貼文ID")
    content: str = Field(..., min_length=1, description="訊息內容")

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_username: str
    recipient_id: int
    recipient_username: str
    post_id: int | None = None
    post_title: str | None = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatSessionResponse(BaseModel):
    other_user_id: int
    other_username: str
    last_message: str
    last_message_time: datetime
    post_id: int | None = None
    post_title: str | None = None

    class Config:
        from_attributes = True
