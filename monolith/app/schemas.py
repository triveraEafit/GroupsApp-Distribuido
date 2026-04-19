from pydantic import BaseModel
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str
    
class GroupCreate(BaseModel):
    name: str
    description: str


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str
    owner_id: int

    class Config:
        from_attributes = True

class DirectMessageResponse(BaseModel):
    id: int
    content: str | None
    sender_id: int
    receiver_id: int
    created_at: datetime
    is_read: bool
    file_name: str | None = None
    file_path: str | None = None
    file_size: int | None = None
    file_type: str | None = None
    
    class Config:
        from_attributes = True