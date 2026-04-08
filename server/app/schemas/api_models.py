from __future__ import annotations

from typing import Any, Dict, List, Optional

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


class ViolationPenaltyBase(BaseModel):
    violation_code: str
    violation_name: str
    fine_amount: int
    description: Optional[str] = None
    is_active: bool = True


class ViolationPenaltyCreateRequest(ViolationPenaltyBase):
    pass


class ViolationPenaltyUpdateRequest(BaseModel):
    violation_code: Optional[str] = None
    violation_name: Optional[str] = None
    fine_amount: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ViolationPenaltyResponse(ViolationPenaltyBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ViolationPenaltyListResponse(BaseModel):
    items: List[ViolationPenaltyResponse]
