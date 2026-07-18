from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func, Float
from sqlalchemy.orm import relationship
from app.core.database import Base

class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    content = Column(Text, nullable=False)
    item_type = Column(String(50), nullable=True)
    approx_location = Column(String(100), nullable=True)  # 格式: "lat,lon"
    status = Column(String(20), default="Open", nullable=False)
    post_type = Column(String(20), default="Request", nullable=False)  # "Request" 或 "Trade"
    price_or_condition = Column(String(200), nullable=True)  # 價格或交換條件
    price = Column(Float, default=0.0, nullable=True)  # 二手交易數值金額 (用於排序)
    item_health = Column(Integer, default=100, nullable=True)  # 物品健康度 (用於排序)
    item_carbon = Column(Float, default=0.0, nullable=True)  # 物品預估碳排 (用於排序)
    image_data = Column(Text, nullable=True)  # 貼文照片 Base64 數據
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # 關聯
    author = relationship("User", back_populates="posts")
    comments = relationship("CommunityComment", back_populates="post", cascade="all, delete-orphan")
