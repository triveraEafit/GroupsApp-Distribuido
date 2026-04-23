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
    partition_slot: int = 0
    replica_group: str = "primary"

    class Config:
        from_attributes = True


class GroupChannelCreate(BaseModel):
    name: str
    description: str = ""


class GroupChannelResponse(BaseModel):
    id: int
    group_id: int
    name: str
    description: str | None = None
    is_default: bool = False
    partition_slot: int = 0
    replica_group: str = "primary"
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class GroupDistributionResponse(BaseModel):
    group_id: int
    coordination_enabled: bool
    coordination_healthy: bool
    partition_strategy: str
    shard_count: int
    replication_factor: int
    group_partition_slot: int
    group_replica_group: str
    channels: list[GroupChannelResponse]


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


class GroupMessageReceiptPayload(BaseModel):
    group_id: int
    channel_id: int | None = None
    message_id: int | None = None


class GroupMessageReceiptSummary(BaseModel):
    delivered_count: int = 0
    read_count: int = 0
    total_recipients: int = 0
    delivered_by: list[str] = []
    read_by: list[str] = []


class GroupMessageResponse(BaseModel):
    id: int
    content: str | None
    user_id: int
    username: str | None = None
    group_id: int
    channel_id: int | None = None
    created_at: datetime | None = None
    file_name: str | None = None
    file_path: str | None = None
    file_size: int | None = None
    file_type: str | None = None
    file_checksum: str | None = None
    storage_provider: str | None = None
    receipt_summary: GroupMessageReceiptSummary | None = None


class GroupContactResponse(BaseModel):
    user_id: int
    username: str
