from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel


class ProcessVideoResponse(BaseModel):
    total_violations: int
    violations: List[Dict[str, Any]]


class UploadImageResponse(BaseModel):
    file_name: str
    storage_url: str
