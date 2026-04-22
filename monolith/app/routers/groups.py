from datetime import datetime, timezone
import os
import uuid

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app import models, schemas
from app.coordination import coordination_service
from app.database import get_db
from app.database import SessionLocal
from app.oauth2 import get_current_user
from app.oauth2 import verify_access_token
from app.storage import storage_service
from app.websocket_manager import ConnectionManager
from app.config import UPLOAD_DIR

router = APIRouter(
    prefix="/groups",
    tags=["Groups"]
)

UPLOAD_DIR.mkdir(exist_ok=True)
VALID_ROLES = {"admin", "moderator", "member"}
VALID_MEMBER_STATUS = {"pending", "active", "rejected", "left", "banned"}
VALID_SUBSCRIPTION_MODE = {"open", "approval", "invite_only"}


def _must_be_active_member(db: Session, group_id: int, user_id: int) -> models.GroupMember:
    member = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == user_id,
        models.GroupMember.status == "active",
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="You are not an active member of this group")
    return member


def _must_be_group_admin_or_mod(db: Session, group_id: int, user_id: int) -> models.GroupMember:
    member = _must_be_active_member(db, group_id, user_id)
    if member.role not in {"admin", "moderator"}:
        raise HTTPException(status_code=403, detail="Admin or moderator role required")
    return member


def _dm_event(message: models.DirectMessage, sender_username: str, event_type: str) -> dict:
    return {
        "type": event_type,
        "message_id": message.id,
        "content": message.content,
        "sender_id": message.sender_id,
        "sender_username": sender_username,
        "receiver_id": message.receiver_id,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "is_read": message.is_read,
        "file_name": message.file_name,
        "file_path": message.file_path,
        "file_size": message.file_size,
        "file_type": message.file_type,
        "file_checksum": message.file_checksum,
        "storage_provider": message.storage_provider,
    }


@router.post("/", response_model=schemas.GroupResponse)
def create_group(
    group: schemas.GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if group.subscription_mode not in VALID_SUBSCRIPTION_MODE:
        raise HTTPException(status_code=400, detail="Invalid subscription_mode")

    new_group = models.Group(
        name=group.name,
        description=group.description,
        owner_id=current_user.id,
        subscription_mode=group.subscription_mode,
        allow_member_invites=group.allow_member_invites,
        max_members=group.max_members,
    )

    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    db.add(models.GroupMember(
        user_id=current_user.id,
        group_id=new_group.id,
        role="admin",
        status="active",
        approved_by=current_user.id,
    ))
    db.commit()

    return new_group


@router.post("/{group_id}/join")
def join_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    with coordination_service.lock(f"group_join_{group_id}"):
        existing = db.query(models.GroupMember).filter_by(
            user_id=current_user.id,
            group_id=group_id
        ).first()

        if existing and existing.status == "active":
            raise HTTPException(status_code=400, detail="Already a member")
        if existing and existing.status == "banned":
            raise HTTPException(status_code=403, detail="You are banned from this group")

        current_members = db.query(models.GroupMember).filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.status == "active",
        ).count()
        if group.max_members and current_members >= group.max_members:
            raise HTTPException(status_code=400, detail="Group is full")

        status = "active" if group.subscription_mode == "open" else "pending"
        role = "member"
        if existing:
            existing.status = status
            existing.role = role
            existing.left_at = None
        else:
            existing = models.GroupMember(
                user_id=current_user.id,
                group_id=group_id,
                role=role,
                status=status,
            )
            db.add(existing)
        db.commit()

    if status == "pending":
        return {"message": "Join request sent", "status": "pending"}
    return {"message": "Joined group successfully", "status": "active"}


@router.post("/{group_id}/members/request")
def request_join_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return join_group(group_id=group_id, db=db, current_user=current_user)


@router.post("/{group_id}/members/{user_id}/approve")
def approve_group_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _must_be_group_admin_or_mod(db, group_id, current_user.id)
    membership = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    membership.status = "active"
    membership.approved_by = current_user.id
    db.commit()
    return {"message": "Member approved"}


@router.post("/{group_id}/members/{user_id}/reject")
def reject_group_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _must_be_group_admin_or_mod(db, group_id, current_user.id)
    membership = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    membership.status = "rejected"
    db.commit()
    return {"message": "Member rejected"}


@router.post("/{group_id}/members/{user_id}/promote")
def promote_group_member(
    group_id: int,
    user_id: int,
    payload: schemas.GroupMemberUpdateRole,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    admin_member = _must_be_active_member(db, group_id, current_user.id)
    if admin_member.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    if payload.role not in {"admin", "moderator", "member"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    membership = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == user_id,
        models.GroupMember.status == "active",
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Active member not found")
    membership.role = payload.role
    db.commit()
    return {"message": "Member role updated", "role": payload.role}


@router.post("/{group_id}/members/{user_id}/demote")
def demote_group_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return promote_group_member(
        group_id=group_id,
        user_id=user_id,
        payload=schemas.GroupMemberUpdateRole(role="member"),
        db=db,
        current_user=current_user,
    )


@router.delete("/{group_id}/members/{user_id}")
def remove_group_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _must_be_group_admin_or_mod(db, group_id, current_user.id)
    membership = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    membership.status = "left"
    membership.left_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Member removed"}


@router.post("/{group_id}/leave")
def leave_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    membership = _must_be_active_member(db, group_id, current_user.id)
    membership.status = "left"
    membership.left_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Left group successfully"}


@router.get("/{group_id}/members")
def list_group_members(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _must_be_active_member(db, group_id, current_user.id)
    members = db.query(models.GroupMember, models.User.username).join(
        models.User, models.User.id == models.GroupMember.user_id
    ).filter(models.GroupMember.group_id == group_id).all()
    return [
        {
            "user_id": member.user_id,
            "username": username,
            "role": member.role,
            "status": member.status,
            "joined_at": member.joined_at,
        }
        for member, username in members
    ]


@router.get("/{group_id}/contacts")
def list_group_contacts(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _must_be_active_member(db, group_id, current_user.id)
    contacts = db.query(models.GroupContact, models.User.username).join(
        models.User, models.User.id == models.GroupContact.contact_user_id
    ).filter(
        models.GroupContact.group_id == group_id,
        models.GroupContact.owner_user_id == current_user.id,
    ).all()
    return [{"user_id": c.contact_user_id, "username": u} for c, u in contacts]


@router.post("/{group_id}/contacts")
def add_group_contact(
    group_id: int,
    payload: schemas.GroupContactCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _must_be_active_member(db, group_id, current_user.id)
    contact = db.query(models.User).filter(models.User.username == payload.contact_username).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact user not found")
    _must_be_active_member(db, group_id, contact.id)
    existing = db.query(models.GroupContact).filter(
        models.GroupContact.group_id == group_id,
        models.GroupContact.owner_user_id == current_user.id,
        models.GroupContact.contact_user_id == contact.id,
    ).first()
    if existing:
        return {"message": "Contact already exists"}
    db.add(models.GroupContact(
        group_id=group_id,
        owner_user_id=current_user.id,
        contact_user_id=contact.id,
    ))
    db.commit()
    return {"message": "Contact added"}


@router.delete("/{group_id}/contacts/{contact_user_id}")
def delete_group_contact(
    group_id: int,
    contact_user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _must_be_active_member(db, group_id, current_user.id)
    deleted = db.query(models.GroupContact).filter(
        models.GroupContact.group_id == group_id,
        models.GroupContact.owner_user_id == current_user.id,
        models.GroupContact.contact_user_id == contact_user_id,
    ).delete()
    db.commit()
    return {"message": "Contact removed", "deleted": deleted}

manager = ConnectionManager()

@router.websocket("/ws/{group_id}")
async def websocket_endpoint(websocket: WebSocket, group_id: int):

    print("---- WebSocket attempt ----")

    token = websocket.query_params.get("token")
    print("TOKEN:", token)

    if not token:
        print("NO TOKEN")
        await websocket.close(code=1008)
        return

    try:
        payload = verify_access_token(token)
        print("PAYLOAD:", payload)
        user_id = int(payload.get("sub"))
        print("USER ID:", user_id)
    except Exception as e:
        print("TOKEN ERROR:", e)
        await websocket.close(code=1008)
        return

    db = SessionLocal()

    membership = db.query(models.GroupMember).filter_by(
        user_id=user_id,
        group_id=group_id,
        status="active",
    ).first()

    print("MEMBERSHIP:", membership)

    if not membership:
        print("NOT A MEMBER")
        await websocket.close(code=1008)
        return

    await manager.connect(group_id, websocket, user_id)
    print("CONNECTED SUCCESSFULLY")

    try:
        while True:
            data = await websocket.receive_text()
            print("MESSAGE RECEIVED:", data)

            message = models.Message(
                content=data,
                user_id=user_id,
                group_id=group_id
            )

            db.add(message)
            db.commit()
            db.refresh(message)

            await manager.broadcast_json(group_id, {
                "type": "group_message",
                "message_id": message.id,
                "content": data,
                "user_id": user_id,
                "group_id": group_id,
                "created_at": message.created_at.isoformat() if message.created_at else None,
            })

    except WebSocketDisconnect:
        print("DISCONNECTED")
        manager.disconnect(group_id, websocket, user_id)
    finally:
        db.close()

@router.get("/{group_id}/messages")
def get_group_messages(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    _must_be_active_member(db, group_id, current_user.id)
    messages = db.query(models.Message).filter(
        models.Message.group_id == group_id
    ).order_by(models.Message.id).all()

    return messages

@router.get("/my-groups")
def get_my_groups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    groups = (
        db.query(models.Group)
        .join(models.GroupMember, models.Group.id == models.GroupMember.group_id)
        .filter(
            models.GroupMember.user_id == current_user.id,
            models.GroupMember.status == "active",
        )
        .all()
    )

    return groups



@router.websocket("/dm/ws/{other_username}")
async def dm_websocket_endpoint(websocket: WebSocket, other_username: str):
    """
    WebSocket para chat 1 a 1 con un usuario específico.
    URL: ws://127.0.0.1:8000/groups/dm/ws/{username}?token=JWT
    """
    print(f"---- DM WebSocket attempt with {other_username} ----")

    token = websocket.query_params.get("token")
    
    if not token:
        print("NO TOKEN")
        await websocket.close(code=1008)
        return

    try:
        payload = verify_access_token(token)
        user_id = int(payload.get("sub"))
        print(f"USER ID: {user_id}")
    except Exception as e:
        print("TOKEN ERROR:", e)
        await websocket.close(code=1008)
        return

    db = SessionLocal()

    current_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not current_user:
        print("USER NOT FOUND")
        await websocket.close(code=1008)
        db.close()
        return

    other_user = db.query(models.User).filter(models.User.username == other_username).first()
    if not other_user:
        print(f"OTHER USER '{other_username}' NOT FOUND")
        await websocket.close(code=1008)
        db.close()
        return

    if current_user.id == other_user.id:
        print("CANNOT CHAT WITH YOURSELF")
        await websocket.close(code=1008)
        db.close()
        return

    await manager.connect_dm(current_user.id, other_user.id, websocket)
    print(f"DM CONNECTED: {current_user.username} <-> {other_user.username}")

    db.query(models.DirectMessage).filter(
        models.DirectMessage.sender_id == other_user.id,
        models.DirectMessage.receiver_id == current_user.id,
        models.DirectMessage.is_read == False
    ).update({"is_read": True})
    db.commit()

    connection_msg = f"[Sistema] {current_user.username} se conectó al chat"
    await manager.broadcast_dm(current_user.id, other_user.id, connection_msg)

    try:
        while True:
            data = await websocket.receive_text()
            print(f"DM MESSAGE: {current_user.username} -> {other_user.username}: {data}")

            dm = models.DirectMessage(
                content=data,
                sender_id=current_user.id,
                receiver_id=other_user.id
            )
            db.add(dm)
            db.commit()
            db.refresh(dm)

            formatted_msg = f"{current_user.username}: {data}"
            await manager.broadcast_dm(current_user.id, other_user.id, formatted_msg)
            await manager.broadcast_dm_json(
                current_user.id,
                other_user.id,
                _dm_event(dm, current_user.username, "dm_message"),
            )

    except WebSocketDisconnect:
        print(f"DM DISCONNECTED: {current_user.username} <-> {other_user.username}")
        manager.disconnect_dm(current_user.id, other_user.id, websocket)
        
        disconnect_msg = f"[Sistema] {current_user.username} se desconectó"
        await manager.broadcast_dm(current_user.id, other_user.id, disconnect_msg)
    except Exception as e:
        print(f"DM ERROR: {e}")
        manager.disconnect_dm(current_user.id, other_user.id, websocket)
    finally:
        db.close()


@router.get("/dm/history/{username}", response_model=list[schemas.DirectMessageResponse])
def get_dm_history(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Obtener historial completo de mensajes con un usuario específico"""
    
    other_user = db.query(models.User).filter(
        models.User.username == username
    ).first()
    
    if not other_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    messages = db.query(models.DirectMessage).filter(
        ((models.DirectMessage.sender_id == current_user.id) & 
         (models.DirectMessage.receiver_id == other_user.id)) |
        ((models.DirectMessage.sender_id == other_user.id) & 
         (models.DirectMessage.receiver_id == current_user.id))
    ).order_by(models.DirectMessage.created_at).all()
    
    return messages


@router.get("/dm/unread", response_model=list[schemas.DirectMessageResponse])
def get_unread_messages(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Obtener todos los mensajes no leídos"""
    
    unread = db.query(models.DirectMessage).filter(
        models.DirectMessage.receiver_id == current_user.id,
        models.DirectMessage.is_read == False
    ).order_by(models.DirectMessage.created_at).all()
    
    return unread


@router.post("/dm/mark-read/{username}")
async def mark_messages_as_read(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Marcar todos los mensajes de un usuario como leídos"""
    
    other_user = db.query(models.User).filter(
        models.User.username == username
    ).first()
    
    if not other_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    unread_messages = db.query(models.DirectMessage).filter(
        models.DirectMessage.sender_id == other_user.id,
        models.DirectMessage.receiver_id == current_user.id,
        models.DirectMessage.is_read == False
    ).all()

    updated = 0
    for message in unread_messages:
        message.is_read = True
        receipt = db.query(models.DirectMessageReceipt).filter(
            models.DirectMessageReceipt.message_id == message.id,
            models.DirectMessageReceipt.user_id == current_user.id,
        ).first()
        if not receipt:
            receipt = models.DirectMessageReceipt(
                message_id=message.id,
                user_id=current_user.id,
            )
            db.add(receipt)
        if not receipt.delivered_at:
            receipt.delivered_at = datetime.now(timezone.utc)
        receipt.read_at = datetime.now(timezone.utc)
        updated += 1

    db.commit()

    for message in unread_messages:
        await manager.broadcast_dm_json(
            current_user.id,
            other_user.id,
            {
                "type": "dm_receipt",
                "message_id": message.id,
                "user_id": current_user.id,
                "delivered_at": datetime.now(timezone.utc).isoformat(),
                "read_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    return {"message": f"{updated} mensajes marcados como leídos"}


@router.post("/dm/receipts/delivered", response_model=schemas.DirectMessageReceiptResponse)
async def mark_dm_delivered(
    payload: schemas.DirectMessageReceiptPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    message = db.query(models.DirectMessage).filter(
        models.DirectMessage.id == payload.message_id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if current_user.id not in {message.sender_id, message.receiver_id}:
        raise HTTPException(status_code=403, detail="Forbidden")
    receipt = db.query(models.DirectMessageReceipt).filter(
        models.DirectMessageReceipt.message_id == message.id,
        models.DirectMessageReceipt.user_id == current_user.id,
    ).first()
    if not receipt:
        receipt = models.DirectMessageReceipt(message_id=message.id, user_id=current_user.id)
        db.add(receipt)
    if not receipt.delivered_at:
        receipt.delivered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(receipt)
    await manager.broadcast_dm_json(
        message.sender_id,
        message.receiver_id,
        {
            "type": "dm_receipt",
            "message_id": message.id,
            "user_id": current_user.id,
            "delivered_at": receipt.delivered_at.isoformat() if receipt.delivered_at else None,
            "read_at": receipt.read_at.isoformat() if receipt.read_at else None,
        },
    )
    return schemas.DirectMessageReceiptResponse(
        message_id=receipt.message_id,
        user_id=receipt.user_id,
        delivered_at=receipt.delivered_at,
        read_at=receipt.read_at,
    )


@router.post("/dm/receipts/read", response_model=schemas.DirectMessageReceiptResponse)
async def mark_dm_read(
    payload: schemas.DirectMessageReceiptPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    message = db.query(models.DirectMessage).filter(
        models.DirectMessage.id == payload.message_id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if current_user.id not in {message.sender_id, message.receiver_id}:
        raise HTTPException(status_code=403, detail="Forbidden")
    receipt = db.query(models.DirectMessageReceipt).filter(
        models.DirectMessageReceipt.message_id == message.id,
        models.DirectMessageReceipt.user_id == current_user.id,
    ).first()
    if not receipt:
        receipt = models.DirectMessageReceipt(message_id=message.id, user_id=current_user.id)
        db.add(receipt)
    now = datetime.now(timezone.utc)
    if not receipt.delivered_at:
        receipt.delivered_at = now
    receipt.read_at = now
    message.is_read = True
    db.commit()
    db.refresh(receipt)
    await manager.broadcast_dm_json(
        message.sender_id,
        message.receiver_id,
        {
            "type": "dm_receipt",
            "message_id": message.id,
            "user_id": current_user.id,
            "delivered_at": receipt.delivered_at.isoformat() if receipt.delivered_at else None,
            "read_at": receipt.read_at.isoformat() if receipt.read_at else None,
        },
    )
    return schemas.DirectMessageReceiptResponse(
        message_id=receipt.message_id,
        user_id=receipt.user_id,
        delivered_at=receipt.delivered_at,
        read_at=receipt.read_at,
    )


@router.get("/online-users")
def get_online_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Devuelve lista de usuarios online"""
    online_user_ids = manager.get_online_users()
    
    if not online_user_ids:
        return []
    
    users = db.query(models.User).filter(
        models.User.id.in_(online_user_ids)
    ).all()
    
    return [{"id": u.id, "username": u.username, "email": u.email} for u in users]


@router.get("/user/{user_id}/online")
def check_user_online(
    user_id: int,
    current_user: models.User = Depends(get_current_user)
):
    """Verificar si un usuario específico está online"""
    return {"user_id": user_id, "is_online": manager.is_user_online(user_id)}


@router.get("/user/by-username/{username}/online")
def check_user_online_by_username(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Verificar si un usuario específico está online por su username"""
    user = db.query(models.User).filter(models.User.username == username).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {
        "user_id": user.id,
        "username": user.username,
        "is_online": manager.is_user_online(user.id)
    }


@router.post("/dm/upload/{username}")
async def upload_file_to_user(
    username: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Subir un archivo y enviarlo como mensaje directo a un usuario"""
    
    # Verificar que el usuario receptor existe
    receiver = db.query(models.User).filter(models.User.username == username).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Generar nombre único para el archivo
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Guardar archivo
    try:
        contents = await file.read()
        checksum = storage_service.checksum(contents)
        provider, stored_key = storage_service.upload_bytes(
            object_key=str(unique_filename),
            data=contents,
            content_type=file.content_type,
        )
        if provider == "local":
            with open(file_path, "wb") as f:
                f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar archivo: {str(e)}")
    
    # Crear mensaje con el archivo adjunto
    dm = models.DirectMessage(
        content=f"📎 File attachment: {file.filename}",
        sender_id=current_user.id,
        receiver_id=receiver.id,
        file_name=file.filename,
        file_path=str(stored_key),  # Guardar solo object key
        file_size=len(contents),
        file_type=file.content_type,
        file_checksum=checksum,
        storage_provider=provider,
    )
    
    db.add(dm)
    db.commit()
    db.refresh(dm)
    
    # Notificar vía WebSocket si el usuario está conectado
    try:
        message_data = f"[ARCHIVO] {current_user.username} envió: {file.filename}"
        await manager.broadcast_dm(current_user.id, receiver.id, message_data)
        await manager.broadcast_dm_json(
            current_user.id,
            receiver.id,
            _dm_event(dm, current_user.username, "dm_file"),
        )
    except Exception:
        pass  # Si no está conectado, el mensaje quedará guardado
    
    return {
        "message": "Archivo subido correctamente",
        "file_id": dm.id,
        "file_name": file.filename,
        "file_size": len(contents)
    }


@router.get("/dm/download/{message_id}")
async def download_file(
    message_id: int,
    token: str = None,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db)
):
    """Descargar un archivo adjunto de un mensaje
    
    Acepta autenticación vía query param: ?token={token}
    """
    
    print(f"📥 Download request for message_id={message_id}, token present: {bool(token)}")
    
    # Autenticar con bearer header o token de query param
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
    if not token:
        print("❌ No token provided")
        raise HTTPException(status_code=401, detail="Token requerido en query parameter")
    
    try:
        payload = verify_access_token(token)
        user_id = int(payload.get("sub"))
        print(f"✅ Token verified, user_id={user_id}")
        current_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not current_user:
            print(f"❌ User {user_id} not found in database")
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        print(f"✅ User found: {current_user.username}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Token error: {e}")
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")
    
    # Buscar el mensaje
    message = db.query(models.DirectMessage).filter(
        models.DirectMessage.id == message_id
    ).first()
    
    if not message:
        print(f"❌ Message {message_id} not found")
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    print(f"✅ Message found: sender={message.sender_id}, receiver={message.receiver_id}")
    print(f"   File: {message.file_name} -> {message.file_path}")
    
    # Verificar que el usuario actual es el emisor o receptor
    if message.sender_id != current_user.id and message.receiver_id != current_user.id:
        print(f"❌ User {current_user.id} not authorized (not sender or receiver)")
        raise HTTPException(status_code=403, detail="No tienes permiso para descargar este archivo")
    
    # Verificar que el mensaje tiene un archivo adjunto
    if not message.file_path:
        print("❌ Message has no file attached")
        raise HTTPException(status_code=404, detail="Este mensaje no tiene archivo adjunto")
    
    if message.storage_provider == "s3":
        try:
            payload = storage_service.download_bytes(message.file_path)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Could not fetch file from storage: {str(exc)}")
        return Response(
            content=payload,
            media_type=message.file_type or "application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{message.file_name or "download.bin"}"',
            },
        )

    # Construir ruta completa del archivo
    file_path = UPLOAD_DIR / message.file_path
    print(f"📁 Looking for file at: {file_path}")
    print(f"   File exists: {file_path.exists()}")
    
    if not file_path.exists():
        print(f"❌ File not found on disk: {file_path}")
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el servidor")
    
    print(f"✅ Serving file: {message.file_name}")
    # Devolver el archivo
    return FileResponse(
        path=file_path,
        filename=message.file_name,
        media_type=message.file_type or "application/octet-stream"
    )
