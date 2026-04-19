from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.oauth2 import get_current_user
from fastapi import HTTPException
from fastapi import WebSocket, WebSocketDisconnect
from app.websocket_manager import ConnectionManager
from app.oauth2 import verify_access_token
from app.database import SessionLocal
from app.config import UPLOAD_DIR
from fastapi.responses import FileResponse
import os
import uuid

router = APIRouter(
    prefix="/groups",
    tags=["Groups"]
)

UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/", response_model=schemas.GroupResponse)
def create_group(
    group: schemas.GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_group = models.Group(
        name=group.name,
        description=group.description,
        owner_id=current_user.id
    )

    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return new_group

@router.post("/{group_id}/join")
def join_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    existing = db.query(models.GroupMember).filter_by(
        user_id=current_user.id,
        group_id=group_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Already a member")

    membership = models.GroupMember(
        user_id=current_user.id,
        group_id=group_id
    )

    db.add(membership)
    db.commit()

    return {"message": "Joined group successfully"}

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
        group_id=group_id
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

            await manager.broadcast(group_id, data)

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
        .filter(models.GroupMember.user_id == current_user.id)
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

            formatted_msg = f"{current_user.username}: {data}"
            await manager.broadcast_dm(current_user.id, other_user.id, formatted_msg)

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
def mark_messages_as_read(
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
    
    updated = db.query(models.DirectMessage).filter(
        models.DirectMessage.sender_id == other_user.id,
        models.DirectMessage.receiver_id == current_user.id,
        models.DirectMessage.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    
    return {"message": f"{updated} mensajes marcados como leídos"}


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
        file_path=str(unique_filename),  # Guardar solo el nombre, no la ruta completa
        file_size=len(contents),
        file_type=file.content_type
    )
    
    db.add(dm)
    db.commit()
    db.refresh(dm)
    
    # Notificar vía WebSocket si el usuario está conectado
    try:
        message_data = f"[ARCHIVO] {current_user.username} envió: {file.filename}"
        await manager.broadcast_dm(current_user.id, receiver.id, message_data)
    except:
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
    db: Session = Depends(get_db)
):
    """Descargar un archivo adjunto de un mensaje
    
    Acepta autenticación vía query param: ?token={token}
    """
    
    print(f"📥 Download request for message_id={message_id}, token present: {bool(token)}")
    
    # Autenticar con el token del query parameter
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
