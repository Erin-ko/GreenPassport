from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class ItemPassport(Base):
    __tablename__ = "item_passports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    material = Column(String(100), nullable=True)
    image_data = Column(Text, nullable=True)  # 用於存放 Base64 或圖片連結
    purchase_date = Column(Date, nullable=False)
    estimated_expiry = Column(Date, nullable=False)
    reminder_interval_days = Column(Integer, default=30, nullable=False)
    health_status = Column(String(20), default="Good", nullable=False)
    category = Column(String(50), nullable=True)  # 新增：例如 hardware_furniture, food...
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # 關聯
    owner = relationship("User", back_populates="items")
    records = relationship("MaintenanceRecord", back_populates="item", cascade="all, delete-orphan")
