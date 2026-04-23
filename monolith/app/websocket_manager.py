from fastapi import WebSocket
from typing import Any, Dict, List, Set, Tuple

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.group_user_connections: Dict[int, Dict[int, Set[WebSocket]]] = {}
        self.dm_connections: Dict[Tuple[int, int], List[WebSocket]] = {}
        # Rastrear usuarios online: user_id -> set de websockets
        self.online_users: Dict[int, Set[WebSocket]] = {}

    async def connect(self, group_id: int, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if group_id not in self.active_connections:
            self.active_connections[group_id] = []
        self.active_connections[group_id].append(websocket)
        if group_id not in self.group_user_connections:
            self.group_user_connections[group_id] = {}
        if user_id not in self.group_user_connections[group_id]:
            self.group_user_connections[group_id][user_id] = set()
        self.group_user_connections[group_id][user_id].add(websocket)
        
        # Registrar usuario como online
        if user_id not in self.online_users:
            self.online_users[user_id] = set()
        self.online_users[user_id].add(websocket)

    def disconnect(self, group_id: int, websocket: WebSocket, user_id: int):
        if group_id in self.active_connections:
            if websocket in self.active_connections[group_id]:
                self.active_connections[group_id].remove(websocket)
            if not self.active_connections[group_id]:
                del self.active_connections[group_id]
        if group_id in self.group_user_connections and user_id in self.group_user_connections[group_id]:
            self.group_user_connections[group_id][user_id].discard(websocket)
            if not self.group_user_connections[group_id][user_id]:
                del self.group_user_connections[group_id][user_id]
            if not self.group_user_connections[group_id]:
                del self.group_user_connections[group_id]
        
        # Remover conexión del usuario
        if user_id in self.online_users:
            self.online_users[user_id].discard(websocket)
            # Si no tiene más conexiones, remover del diccionario
            if not self.online_users[user_id]:
                del self.online_users[user_id]

    async def broadcast(self, group_id: int, message: str):
        for connection in self.active_connections.get(group_id, []):
            await connection.send_text(message)

    async def broadcast_json(self, group_id: int, payload: Dict[str, Any]):
        for connection in self.active_connections.get(group_id, []):
            await connection.send_json(payload)

    def get_group_online_user_ids(self, group_id: int) -> List[int]:
        return list(self.group_user_connections.get(group_id, {}).keys())
    
    def _get_dm_key(self, user1_id: int, user2_id: int) -> Tuple[int, int]:
        """Genera una clave ordenada para la conversación entre dos usuarios"""
        return tuple(sorted([user1_id, user2_id]))
    
    async def connect_dm(self, user1_id: int, user2_id: int, websocket: WebSocket):
        """Conectar a una conversación DM específica"""
        await websocket.accept()
        key = self._get_dm_key(user1_id, user2_id)
        if key not in self.dm_connections:
            self.dm_connections[key] = []
        self.dm_connections[key].append(websocket)
        
        # Registrar usuario como online
        if user1_id not in self.online_users:
            self.online_users[user1_id] = set()
        self.online_users[user1_id].add(websocket)
    
    def disconnect_dm(self, user1_id: int, user2_id: int, websocket: WebSocket):
        """Desconectar de una conversación DM"""
        key = self._get_dm_key(user1_id, user2_id)
        if key in self.dm_connections:
            self.dm_connections[key].remove(websocket)
            if not self.dm_connections[key]:
                del self.dm_connections[key]
        
        # Remover conexión del usuario
        if user1_id in self.online_users:
            self.online_users[user1_id].discard(websocket)
            if not self.online_users[user1_id]:
                del self.online_users[user1_id]
    
    async def broadcast_dm(self, user1_id: int, user2_id: int, message: str):
        """Enviar mensaje a todos los conectados en esa conversación DM"""
        key = self._get_dm_key(user1_id, user2_id)
        for connection in self.dm_connections.get(key, []):
            await connection.send_text(message)

    async def broadcast_dm_json(self, user1_id: int, user2_id: int, payload: Dict[str, Any]):
        key = self._get_dm_key(user1_id, user2_id)
        for connection in self.dm_connections.get(key, []):
            await connection.send_json(payload)
    
    def is_user_online(self, user_id: int) -> bool:
        """Verificar si un usuario está online"""
        return user_id in self.online_users and len(self.online_users[user_id]) > 0
    
    def get_online_users(self) -> List[int]:
        """Obtener lista de IDs de usuarios online"""
        return list(self.online_users.keys())
