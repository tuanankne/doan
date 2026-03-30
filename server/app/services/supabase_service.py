from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from supabase import Client, create_client
from storage3.exceptions import StorageApiError


class SupabaseStorageService:
    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        bucket: str,
        client: Optional[Client] = None,
    ) -> None:
        if client is None:
            self.client = create_client(supabase_url, supabase_key)
        else:
            self.client = client
        self.bucket = bucket
        self._bucket_ready = False

    @staticmethod
    def _extract_rows(response: Any) -> list:
        rows = getattr(response, "data", None)
        if rows is None and isinstance(response, dict):
            rows = response.get("data")
        return rows or []

    def ensure_bucket_exists(self, public: bool = True) -> None:
        if self._bucket_ready:
            return

        buckets_response = self.client.storage.list_buckets()
        buckets = self._extract_rows(buckets_response)
        existing = None
        for bucket in buckets:
            bucket_id = str(bucket.get("id", ""))
            bucket_name = str(bucket.get("name", ""))
            if bucket_id == self.bucket or bucket_name == self.bucket:
                existing = bucket
                break

        if existing is None:
            try:
                self.client.storage.create_bucket(
                    self.bucket,
                    options={
                        "public": public,
                        "file_size_limit": "50MB",
                    },
                )
            except StorageApiError as exc:
                message = str(exc).lower()
                if "already exists" not in message and "duplicate" not in message:
                    raise

        self._bucket_ready = True

    def upload_bytes(
        self,
        data: bytes,
        storage_path: str,
        content_type: str,
        upsert: bool = True,
    ) -> str:
        self.ensure_bucket_exists(public=True)

        result = self.client.storage.from_(self.bucket).upload(
            storage_path,
            data,
            file_options={
                "content-type": content_type,
                "upsert": "true" if upsert else "false",
            },
        )

        if isinstance(result, dict) and result.get("error"):
            raise RuntimeError(f"Supabase upload error: {result['error']}")

        public_url_data = self.client.storage.from_(self.bucket).get_public_url(storage_path)
        if isinstance(public_url_data, dict):
            return str(public_url_data.get("publicURL") or public_url_data.get("publicUrl") or "")

        return str(public_url_data)

    def upload_file(
        self,
        file_path: str,
        content_type: str,
        folder: str = "manual",
        upsert: bool = False,
    ) -> str:
        path_obj = Path(file_path)
        if not path_obj.exists() or not path_obj.is_file():
            raise FileNotFoundError(f"File not found: {file_path}")

        now = datetime.now(timezone.utc)
        storage_path = f"{folder}/{now.strftime('%Y/%m/%d')}/{path_obj.name}"
        data = path_obj.read_bytes()
        return self.upload_bytes(
            data=data,
            storage_path=storage_path,
            content_type=content_type,
            upsert=upsert,
        )
