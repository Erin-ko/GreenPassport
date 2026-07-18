from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.message import ChatMessage
from app.models.post import CommunityPost
from app.schemas.message import MessageCreate, MessageResponse, ChatSessionResponse

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(msg_in: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 驗證接收者是否存在
    recipient = db.query(User).filter(User.id == msg_in.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="找不到接收者使用者")
        
    # 驗證關聯貼文是否存在 (如果有提供)
    post = None
    if msg_in.post_id:
        post = db.query(CommunityPost).filter(CommunityPost.id == msg_in.post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="找不到關聯的募集/交易貼文")
            
    # 建立新訊息
    db_msg = ChatMessage(
        sender_id=current_user.id,
        recipient_id=msg_in.recipient_id,
        post_id=msg_in.post_id,
        content=msg_in.content
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    
    return {
        "id": db_msg.id,
        "sender_id": db_msg.sender_id,
        "sender_username": current_user.username,
        "recipient_id": db_msg.recipient_id,
        "recipient_username": recipient.username,
        "post_id": db_msg.post_id,
        "post_title": post.title if post else None,
        "content": db_msg.content,
        "created_at": db_msg.created_at
    }

@router.get("/history", response_model=list[MessageResponse])
def get_chat_history(other_user_id: int, post_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 查詢與特定用戶的雙向歷史訊息
    query = db.query(ChatMessage).filter(
        ((ChatMessage.sender_id == current_user.id) & (ChatMessage.recipient_id == other_user_id)) |
        ((ChatMessage.sender_id == other_user_id) & (ChatMessage.recipient_id == current_user.id))
    )
    
    # 若有指定貼文，則過濾該貼文的談話；否則只撈取無貼文（一般閒聊）的談話
    if post_id:
        query = query.filter(ChatMessage.post_id == post_id)
    else:
        query = query.filter(ChatMessage.post_id.is_(None))
        
    messages = query.order_by(ChatMessage.created_at.asc()).all()
    
    response_list = []
    for msg in messages:
        response_list.append({
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_username": msg.sender.username,
            "recipient_id": msg.recipient_id,
            "recipient_username": msg.recipient.username,
            "post_id": msg.post_id,
            "post_title": msg.post.title if msg.post else None,
            "content": msg.content,
            "created_at": msg.created_at
        })
        
    return response_list

@router.get("/sessions", response_model=list[ChatSessionResponse])
def get_chat_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 撈取所有該使用者參與的訊息，並按時間倒序
    messages = db.query(ChatMessage).filter(
        (ChatMessage.sender_id == current_user.id) | (ChatMessage.recipient_id == current_user.id)
    ).order_by(ChatMessage.created_at.desc()).all()
    
    sessions_dict = {}
    for msg in messages:
        # 決定對方是誰
        other_user = msg.recipient if msg.sender_id == current_user.id else msg.sender
        
        # 區分對話 Session 的 Key 為 (對方ID, 貼文ID)
        key = (other_user.id, msg.post_id)
        if key not in sessions_dict:
            sessions_dict[key] = {
                "other_user_id": other_user.id,
                "other_username": other_user.username,
                "last_message": msg.content,
                "last_message_time": msg.created_at,
                "post_id": msg.post_id,
                "post_title": msg.post.title if msg.post else "一般聯絡對話"
            }
            
    return list(sessions_dict.values())
