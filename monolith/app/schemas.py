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
    subscription_mode: str = "open"
    allow_member_invites: bool = False
    max_members: int | None = None


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str
    owner_id: int
    subscription_mode: str
    allow_member_invites: bool
    max_members: int | None = None

    class Config:
        from_attributes = True


class GroupMemberUpdateRole(BaseModel):
    role: str


class GroupMemberDecision(BaseModel):
    decision: str


class GroupContactCreate(BaseModel):
    contact_username: str

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
    file_checksum: str | None = None
    storage_provider: str | None = None
    
    class Config:
        from_attributes = True


class DirectMessageReceiptPayload(BaseModel):
    message_id: int


class DirectMessageReceiptResponse(BaseModel):
    message_id: int
    user_id: int
    delivered_at: datetime | None = None
    read_at: datetime | None = None