from sqlalchemy import Column, Integer, Date, DateTime, Text, Numeric, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    item_passport_id = Column(Integer, ForeignKey("item_passports.id", ondelete="CASCADE"), nullable=False)
    maintenance_date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    cost = Column(Numeric(10, 2), default=0.00, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # 關聯
    item = relationship("ItemPassport", back_populates="records")
