import hashlib
from typing import Tuple

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from app.config import (
    S3_ACCESS_KEY,
    S3_BUCKET,
    S3_ENDPOINT_URL,
    S3_PRESIGN_EXPIRY_SECONDS,
    S3_REGION,
    S3_SECRET_KEY,
    STORAGE_PROVIDER,
)


class StorageService:
    def __init__(self) -> None:
        self.provider = STORAGE_PROVIDER
        self.client: BaseClient | None = None
        if self.provider == "s3":
            self.client = boto3.client(
                "s3",
                endpoint_url=S3_ENDPOINT_URL or None,
                aws_access_key_id=S3_ACCESS_KEY or None,
                aws_secret_access_key=S3_SECRET_KEY or None,
                region_name=S3_REGION,
            )

    def ensure_bucket(self) -> None:
        if self.provider != "s3" or self.client is None:
            return
        try:
            self.client.head_bucket(Bucket=S3_BUCKET)
        except ClientError:
            self.client.create_bucket(Bucket=S3_BUCKET)

    def checksum(self, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    def upload_bytes(self, object_key: str, data: bytes, content_type: str | None) -> Tuple[str, str]:
        if self.provider != "s3" or self.client is None:
            return ("local", object_key)
        self.client.put_object(
            Bucket=S3_BUCKET,
            Key=object_key,
            Body=data,
            ContentType=content_type or "application/octet-stream",
        )
        return ("s3", object_key)

    def presigned_download_url(self, object_key: str, file_name: str) -> str | None:
        if self.provider != "s3" or self.client is None:
            return None
        return self.client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": object_key,
                "ResponseContentDisposition": f'attachment; filename="{file_name}"',
            },
            ExpiresIn=S3_PRESIGN_EXPIRY_SECONDS,
        )

    def download_bytes(self, object_key: str) -> bytes:
        if self.provider != "s3" or self.client is None:
            raise RuntimeError("S3 storage provider is not configured")
        response = self.client.get_object(Bucket=S3_BUCKET, Key=object_key)
        return response["Body"].read()


storage_service = StorageService()
