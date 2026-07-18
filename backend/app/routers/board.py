from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.post import CommunityPost
from app.schemas.post import CommunityPostCreate, CommunityPostResponse
from app.core.distance import haversine_distance, get_distance_text

from app.schemas.comment import CommentCreate, CommentResponse
from app.models.comment import CommunityComment

router = APIRouter(prefix="/board", tags=["board"])

@router.post("/posts", response_model=CommunityPostResponse, status_code=status.HTTP_201_CREATED)
def create_post(post_in: CommunityPostCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    loc = post_in.approx_location or current_user.approx_location
    
    db_post = CommunityPost(
        user_id=current_user.id,
        title=post_in.title,
        item_type=post_in.item_type,
        content=post_in.content,
        approx_location=loc,
        post_type=post_in.post_type,
        price_or_condition=post_in.price_or_condition,
        price=post_in.price or 0.0,
        item_health=post_in.item_health or 100,
        item_carbon=post_in.item_carbon or 0.0,
        image_data=post_in.image_data,
        status="Open"
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    return {
        "id": db_post.id,
        "user_id": db_post.user_id,
        "username": current_user.username,
        "title": db_post.title,
        "item_type": db_post.item_type,
        "content": db_post.content,
        "status": db_post.status,
        "post_type": db_post.post_type,
        "price_or_condition": db_post.price_or_condition,
        "price": db_post.price,
        "item_health": db_post.item_health,
        "item_carbon": db_post.item_carbon,
        "image_data": db_post.image_data,
        "created_at": db_post.created_at,
        "distance_text": "本人發布",
        "comments": []
    }

@router.get("/posts", response_model=list[CommunityPostResponse])
def read_posts(user_location: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 僅查詢募集中 (Open) 的貼文
    posts = db.query(CommunityPost).filter(CommunityPost.status == "Open").all()
    
    # 解析查詢者的模糊定位座標
    user_lat, user_lon = None, None
    if user_location:
        try:
            parts = user_location.split(",")
            user_lat = float(parts[0])
            user_lon = float(parts[1])
        except Exception:
            pass
            
    response_list = []
    for post in posts:
        distance_val = float('inf') # 預設距離無限遠，排在最後
        dist_text = "距離不詳"
        
        # 解析發文座標並計算 Haversine 球面距離
        if user_lat is not None and user_lon is not None and post.approx_location:
            try:
                parts = post.approx_location.split(",")
                post_lat = float(parts[0])
                post_lon = float(parts[1])
                
                distance_val = haversine_distance(user_lat, user_lon, post_lat, post_lon)
                dist_text = get_distance_text(distance_val)
            except Exception:
                pass
                
        # 若發文者為當前登入者本人
        if post.user_id == current_user.id:
            dist_text = "本人發布"
            distance_val = -1.0  # 本人發文強制排在最前面
            
        # 轉換留言列表
        comments_list = []
        for comment in post.comments:
            comments_list.append({
                "id": comment.id,
                "post_id": comment.post_id,
                "user_id": comment.user_id,
                "username": comment.author.username,
                "content": comment.content,
                "created_at": comment.created_at
            })
            
        response_list.append({
            "id": post.id,
            "user_id": post.user_id,
            "username": post.author.username,  # 對應 post.py 的 author 關聯
            "title": post.title,
            "item_type": post.item_type,
            "content": post.content,
            "status": post.status,
            "post_type": post.post_type,
            "price_or_condition": post.price_or_condition,
            "price": post.price,
            "item_health": post.item_health,
            "item_carbon": post.item_carbon,
            "image_data": post.image_data,
            "created_at": post.created_at,
            "distance_text": dist_text,
            "comments": comments_list,
            "__sort_key": distance_val  # 僅供排序，Pydantic 序列化時會被剔除
        })
        
    # 依距離由近到遠進行排序，優化鄰里互助體驗
    response_list.sort(key=lambda p: p["__sort_key"])
    return response_list

@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(post_id: int, comment_in: CommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="找不到該貼文")
        
    db_comment = CommunityComment(
        post_id=post_id,
        user_id=current_user.id,
        content=comment_in.content
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    
    return {
        "id": db_comment.id,
        "post_id": db_comment.post_id,
        "user_id": db_comment.user_id,
        "username": current_user.username,
        "content": db_comment.content,
        "created_at": db_comment.created_at
    }
