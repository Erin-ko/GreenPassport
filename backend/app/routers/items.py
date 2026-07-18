from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.item import ItemPassport
from app.models.post import CommunityPost
from app.schemas.item import ItemCreate, ItemResponse, ItemDetailResponse, MaintenanceRecordResponse, ESGStatsResponse
from app.schemas.maintenance import MaintenanceRecordCreate
from app.models.maintenance import MaintenanceRecord
from app.core.passport_helper import get_circular_advice, update_item_health, calculate_carbon

router = APIRouter(prefix="/items", tags=["items"])

@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(item_in: ItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = ItemPassport(
        user_id=current_user.id,
        name=item_in.name,
        material=item_in.material,
        image_data=item_in.image_data,
        purchase_date=item_in.purchase_date,
        estimated_expiry=item_in.estimated_expiry,
        reminder_interval_days=item_in.reminder_interval_days,
        category=item_in.category,
        health_status="Good"
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("", response_model=list[ItemResponse])
def read_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 僅查詢當前登入者且未軟刪除的物品 (Good/Fair/Needs Repair)
    active_statuses = ["Good", "Fair", "Needs Repair"]
    items = db.query(ItemPassport).filter(
        ItemPassport.user_id == current_user.id,
        ItemPassport.health_status.in_(active_statuses)
    ).all()
    return items

@router.get("/reminders", response_model=list[ItemResponse])
def read_reminders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    active_statuses = ["Good", "Fair", "Needs Repair"]
    items = db.query(ItemPassport).filter(
        ItemPassport.user_id == current_user.id,
        ItemPassport.health_status.in_(active_statuses)
    ).all()
    
    reminder_list = []
    from datetime import date
    now = date.today()
    
    for item in items:
        # 計算保養基準日 (如果有維修過就用最近維修日，否則用購買日)
        base_date = item.purchase_date
        if item.records:
            sorted_records = sorted(item.records, key=lambda r: r.maintenance_date, reverse=True)
            if sorted_records:
                base_date = sorted_records[0].maintenance_date
                
        days_since = (now - base_date).days
        days_to_expiry = (item.estimated_expiry - now).days
        
        # 提醒條件：超過保養週期天數，或者距離壽命到期小於 30 天
        if days_since >= item.reminder_interval_days or days_to_expiry <= 30:
            reminder_list.append(item)
            
    return reminder_list

@router.get("/esg-stats", response_model=ESGStatsResponse)
def read_esg_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 查詢該使用者所有的物品，包含已歸檔/軟刪除的物品
    items = db.query(ItemPassport).filter(ItemPassport.user_id == current_user.id).all()
    
    total_points = 0
    total_carbon_saved = 0.0
    maintenance_count = 0
    active_count = 0
    recycled_count = 0
    donated_count = 0
    sold_count = 0
    discarded_count = 0
    
    points_detail = []
    carbon_detail = []
    circular_detail = []
    
    for item in items:
        # 計算材質的碳排係數 (以數值型態計算)
        carbon_str = calculate_carbon(item.material)  # e.g., "12.8 kg CO2e"
        try:
            carbon_val = float(carbon_str.split()[0])
        except (ValueError, IndexError):
            carbon_val = 3.0
            
        m_count = len(item.records)
        maintenance_count += m_count
        
        # 1. 處理狀態
        if item.health_status in ["Good", "Fair", "Needs Repair"]:
            active_count += 1
            # 作用中物品不計入註銷回收的永續積分與減碳量
            pass
        else:
            # 處置後的物品：只有在此階段才核算永續積分與減碳效益
            action_date = item.created_at.strftime("%Y-%m-%d") # 模擬處置時間，以建立時間替代
            if item.health_status == "Donated":
                donated_count += 1
                total_points += 100
                total_carbon_saved += carbon_val
                
                points_detail.append({
                    "name": item.name,
                    "action": "生命週期處置 (轉贈他人)",
                    "detail": f"處置方式: 捐贈公益或跳蚤市場",
                    "points": 100
                })
                carbon_detail.append({
                    "name": item.name,
                    "action": "活化捐贈",
                    "carbon": round(carbon_val, 2)
                })
                circular_detail.append({
                    "name": item.name,
                    "action": "活化捐贈",
                    "material": item.material,
                    "category": item.category,
                    "date": action_date
                })
            elif item.health_status == "Sold":
                sold_count += 1
                total_points += 80
                total_carbon_saved += carbon_val
                
                points_detail.append({
                    "name": item.name,
                    "action": "生命週期處置 (二手交易)",
                    "detail": f"處置方式: 出售/轉讓流通",
                    "points": 80
                })
                carbon_detail.append({
                    "name": item.name,
                    "action": "二手交易",
                    "carbon": round(carbon_val, 2)
                })
                circular_detail.append({
                    "name": item.name,
                    "action": "二手轉售",
                    "material": item.material,
                    "category": item.category,
                    "date": action_date
                })
            elif item.health_status == "Recycled":
                recycled_count += 1
                total_points += 60
                total_carbon_saved += carbon_val * 0.5
                
                points_detail.append({
                    "name": item.name,
                    "action": "生命週期處置 (資源回收)",
                    "detail": f"處置方式: 材質拆解回收",
                    "points": 60
                })
                carbon_detail.append({
                    "name": item.name,
                    "action": "資源回收",
                    "carbon": round(carbon_val * 0.5, 2)
                })
                circular_detail.append({
                    "name": item.name,
                    "action": "資源回收",
                    "material": item.material,
                    "category": item.category,
                    "date": action_date
                })
            elif item.health_status == "Discarded":
                discarded_count += 1
                total_points += 10
                
                points_detail.append({
                    "name": item.name,
                    "action": "生命週期處置 (垃圾報廢)",
                    "detail": f"處置方式: 送往掩埋或焚化",
                    "points": 10
                })
                circular_detail.append({
                    "name": item.name,
                    "action": "垃圾報廢",
                    "material": item.material,
                    "category": item.category,
                    "date": action_date
                })
                
    # 2. 獲取募集與交易貼文歷史紀錄
    posts = db.query(CommunityPost).filter(CommunityPost.user_id == current_user.id).order_by(CommunityPost.created_at.desc()).all()
    post_history = []
    for post in posts:
        post_history.append({
            "title": post.title,
            "post_type": "鄰里微型募集貼文" if post.post_type == "Request" else "二手交易與贈送貼文",
            "status": "進行中" if post.status == "Open" else "已關閉/已完成",
            "date": post.created_at.strftime("%Y-%m-%d")
        })
        
    return {
        "total_points": total_points,
        "total_carbon_saved": round(total_carbon_saved, 2),
        "maintenance_count": maintenance_count,
        "active_count": active_count,
        "recycled_count": recycled_count,
        "donated_count": donated_count,
        "sold_count": sold_count,
        "discarded_count": discarded_count,
        "points_detail": points_detail,
        "carbon_detail": carbon_detail,
        "post_history": post_history,
        "circular_detail": circular_detail
    }

@router.get("/{id}", response_model=ItemDetailResponse)
def read_item(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(ItemPassport).filter(ItemPassport.id == id).first()
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="物品護照不存在"
        )
        
    # 防禦性安全性驗證：防止越權讀取他人所屬物品
    if db_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您沒有存取此物品護照的權限"
        )
        
    # 計算碳排與循環建議
    advice_dict = get_circular_advice(db_item.material, db_item.purchase_date, db_item.estimated_expiry)
    
    # 轉換成 dict 並注入額外欄位，以相容 Pydantic 序列化
    item_detail = {
        "id": db_item.id,
        "user_id": db_item.user_id,
        "name": db_item.name,
        "material": db_item.material,
        "category": db_item.category,
        "image_data": db_item.image_data,
        "purchase_date": db_item.purchase_date,
        "estimated_expiry": db_item.estimated_expiry,
        "reminder_interval_days": db_item.reminder_interval_days,
        "health_status": db_item.health_status,
        "created_at": db_item.created_at,
        "circular_advice": advice_dict,
        "records": db_item.records
    }
    return item_detail

@router.delete("/{id}", response_model=ItemResponse)
def delete_item(id: int, action: str = "Recycled", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(ItemPassport).filter(ItemPassport.id == id).first()
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="物品護照不存在"
        )
        
    # 驗證所有權
    if db_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您沒有修改此物品護照的權限"
        )
        
    # 軟刪除：根據 action 標記狀態 (如 Recycled, Donated, Sold, Discarded)
    valid_actions = ["Recycled", "Donated", "Sold", "Discarded"]
    if action not in valid_actions:
        action = "Recycled"
    db_item.health_status = action
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{id}", response_model=ItemResponse)
def update_item(id: int, item_in: ItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(ItemPassport).filter(ItemPassport.id == id).first()
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="物品護照不存在"
        )
        
    if db_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您沒有修改此物品護照的權限"
        )
        
    db_item.name = item_in.name
    db_item.material = item_in.material
    db_item.purchase_date = item_in.purchase_date
    db_item.estimated_expiry = item_in.estimated_expiry
    db_item.reminder_interval_days = item_in.reminder_interval_days
    db_item.category = item_in.category
    
    if item_in.image_data:
        db_item.image_data = item_in.image_data
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.post("/{id}/maintenance", response_model=MaintenanceRecordResponse, status_code=status.HTTP_201_CREATED)
def create_maintenance(id: int, record_in: MaintenanceRecordCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(ItemPassport).filter(ItemPassport.id == id).first()
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="物品護照不存在"
        )
        
    # 驗證所有權
    if db_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您沒有修改此物品護照的權限"
        )
        
    # 建立維修保養紀錄
    db_record = MaintenanceRecord(
        item_passport_id=db_item.id,
        maintenance_date=record_in.maintenance_date,
        description=record_in.description,
        cost=record_in.cost,
        notes=record_in.notes
    )
    db.add(db_record)
    
    # 自動更新該物品的健康狀態為良好 (Good)
    update_item_health(db_item)
    
    db.commit()
    db.refresh(db_record)
    return db_record
