from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer

from app.database import get_db
from app.models import Message
from app.kafka_producer import publish_message_sent, publish_dm_sent
from app.config import SECRET_KEY, ALGORITHM

router = APIRouter(tags=["Messaging"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:8001/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        username = payload.get("username", f"user_{user_id}")
        return {"user_id": user_id, "username": username}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


class GroupMessageCreate(BaseModel):
    content: str
    group_id: int


class DirectMessageCreate(BaseModel):
    content: str
    receiver_id: int


@router.post("/messages/group")
def send_group_message(
    body: GroupMessageCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    msg = Message(
        content=body.content,
        sender_id=current_user["user_id"],
        sender_username=current_user["username"],
        group_id=body.group_id,
        is_direct=False
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    publish_message_sent({
        "message_id": msg.id,
        "content": msg.content,
        "sender_id": msg.sender_id,
        "sender_username": msg.sender_username,
        "group_id": msg.group_id,
        "created_at": str(msg.created_at)
    })

    return {"message_id": msg.id, "status": "sent"}


@router.post("/messages/dm")
def send_direct_message(
    body: DirectMessageCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    msg = Message(
        content=body.content,
        sender_id=current_user["user_id"],
        sender_username=current_user["username"],
        receiver_id=body.receiver_id,
        is_direct=True
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    publish_dm_sent({
        "message_id": msg.id,
        "content": msg.content,
        "sender_id": msg.sender_id,
        "sender_username": msg.sender_username,
        "receiver_id": msg.receiver_id,
        "created_at": str(msg.created_at)
    })

    return {"message_id": msg.id, "status": "sent"}


@router.get("/messages/group/{group_id}")
def get_group_messages(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    messages = db.query(Message).filter(
        Message.group_id == group_id,
        Message.is_direct == False
    ).order_by(Message.created_at).all()

    return messages


@router.get("/messages/dm/{receiver_id}")
def get_dm_history(
    receiver_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    messages = db.query(Message).filter(
        Message.is_direct == True,
        (
            (Message.sender_id == current_user["user_id"]) &
            (Message.receiver_id == receiver_id)
        ) | (
            (Message.sender_id == receiver_id) &
            (Message.receiver_id == current_user["user_id"])
        )
    ).order_by(Message.created_at).all()

    return messages


@router.get("/health")
def health():
    return {"status": "ok", "service": "messaging"}