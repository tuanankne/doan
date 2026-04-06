from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel


class ProcessVideoResponse(BaseModel):
    total_violations: int
    violations: List[Dict[str, Any]]


class UploadImageResponse(BaseModel):
    file_name: str
    storage_url: str


class ConfirmViolationsRequest(BaseModel):
    violations: List[Dict[str, Any]]


class ConfirmViolationsResponse(BaseModel):
    saved_count: int
