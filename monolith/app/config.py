import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def get_env(name: str, default: str | None = None, *, required: bool = False) -> str:
    value = os.getenv(name, default)
    if required and (value is None or value == ""):
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


DATABASE_URL = get_env("DATABASE_URL", required=True)
SECRET_KEY = get_env("SECRET_KEY", required=True)
ALGORITHM = get_env("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(get_env("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
UPLOAD_DIR = Path(get_env("UPLOAD_DIR", str(BASE_DIR / "uploads")))

STORAGE_PROVIDER = get_env("STORAGE_PROVIDER", "local")
S3_ENDPOINT_URL = get_env("S3_ENDPOINT_URL", "")
S3_ACCESS_KEY = get_env("S3_ACCESS_KEY", "")
S3_SECRET_KEY = get_env("S3_SECRET_KEY", "")
S3_BUCKET = get_env("S3_BUCKET", "groupsapp-files")
S3_REGION = get_env("S3_REGION", "us-east-1")
S3_PRESIGN_EXPIRY_SECONDS = int(get_env("S3_PRESIGN_EXPIRY_SECONDS", "600"))

ETCD_ENDPOINT = get_env("ETCD_ENDPOINT", "")
DISTRIBUTION_SHARDS = int(get_env("DISTRIBUTION_SHARDS", "4"))
DISTRIBUTION_REPLICATION_FACTOR = int(get_env("DISTRIBUTION_REPLICATION_FACTOR", "2"))
