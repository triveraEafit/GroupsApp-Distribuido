import time
from contextlib import contextmanager

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
