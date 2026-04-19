import redis
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.config import REDIS_HOST, REDIS_PORT, SECRET_KEY, ALGORITHM

router = APIRouter(tags=["Presence"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:8001/auth/login")

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        return {"user_id": user_id}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/presence/online")
def set_online(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    redis_client.setex(f"presence:{user_id}", 300, "online")
    return {"user_id": user_id, "status": "online"}


@router.post("/presence/offline")
def set_offline(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    redis_client.delete(f"presence:{user_id}")
    return {"user_id": user_id, "status": "offline"}


@router.get("/presence/{user_id}")
def get_presence(user_id: int, current_user: dict = Depends(get_current_user)):
    status = redis_client.get(f"presence:{user_id}")
    return {
        "user_id": user_id,
        "status": status if status else "offline"
    }


@router.get("/presence/online/all")
def get_all_online(current_user: dict = Depends(get_current_user)):
    keys = redis_client.keys("presence:*")
    online_users = [int(k.split(":")[1]) for k in keys]
    return {"online_users": online_users}


@router.get("/health")
def health():
    return {"status": "ok", "service": "presence"}