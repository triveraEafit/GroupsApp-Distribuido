import time
from contextlib import contextmanager
import json

from etcd3gw import client as etcd3_client

from app.config import ETCD_ENDPOINT


class CoordinationService:
    def __init__(self) -> None:
        self.client = None
        self.enabled = bool(ETCD_ENDPOINT)
        if self.enabled:
            host = ETCD_ENDPOINT.replace("http://", "").replace("https://", "")
            if ":" in host:
                hostname, port = host.split(":", 1)
            else:
                hostname, port = host, "2379"
            self.client = etcd3_client(host=hostname, port=int(port))

    def health(self) -> bool:
        if not self.enabled or self.client is None:
            return False
        try:
            self.client.status()
            return True
        except Exception:
            return False

    def get_flag(self, key: str, default: str = "") -> str:
        if not self.enabled or self.client is None:
            return default
        raw = self.client.get(key)
        if not raw or not raw[0]:
            return default
        return raw[0][0].decode("utf-8")

    def put_json(self, key: str, value: dict) -> bool:
        if not self.enabled or self.client is None:
            return False
        try:
            self.client.put(key, json.dumps(value))
            return True
        except Exception:
            return False

    def get_json(self, key: str, default: dict | None = None) -> dict:
        raw = self.get_flag(key, "")
        if not raw:
            return default or {}
        try:
            return json.loads(raw)
        except Exception:
            return default or {}

    def register_service(self, service_name: str, metadata: dict) -> bool:
        payload = {
            **metadata,
            "service_name": service_name,
            "registered_at": int(time.time()),
        }
        return self.put_json(f"/services/{service_name}", payload)

    @contextmanager
    def lock(self, lock_name: str):
        # Best-effort lock: if etcd is down, continue without blocking service.
        if not self.enabled or self.client is None:
            yield
            return
        key = f"/locks/{lock_name}"
        lease = self.client.lease(10)
        acquired = False
        for _ in range(15):
            try:
                existing = self.client.get(key)
                if not existing or not existing[0]:
                    self.client.put(key, "1", lease=lease)
                    acquired = True
                    break
            except Exception:
                break
            time.sleep(0.1)
        try:
            yield
        finally:
            if acquired:
                try:
                    self.client.delete(key)
                    lease.revoke()
                except Exception:
                    pass


coordination_service = CoordinationService()
