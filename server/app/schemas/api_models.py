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


# ============== Profiles, Vehicles, Driver Licenses Schemas ==============

class ProfileBase(BaseModel):
    full_name: str
    citizen_id: str
    phone_number: str
    address: Optional[str] = None
    date_of_birth: Optional[str] = None  # ISO format: YYYY-MM-DD


class ProfileCreateRequest(ProfileBase):
    pass


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None


class ProfileResponse(ProfileBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProfileResponseWithRelations(ProfileResponse):
    """Profile with decrypted sensitive fields and related driver licenses/vehicles."""
    driver_licenses: List[str] = []  # List of license IDs or empty
    vehicles: List[str] = []  # List of vehicle IDs or empty


class ProfileListResponse(BaseModel):
    items: List[ProfileResponseWithRelations]


class DriverLicenseBase(BaseModel):
    citizen_id: str
    license_number: str
    license_class: str
    issued_date: str  # ISO format: YYYY-MM-DD
    expiry_date: Optional[str] = None
    issuing_authority: Optional[str] = None
    points: int = 12
    status: str = "Hoạt động"


class DriverLicenseCreateRequest(DriverLicenseBase):
    pass


class DriverLicenseUpdateRequest(BaseModel):
    license_number: Optional[str] = None
    license_class: Optional[str] = None
    issued_date: Optional[str] = None
    expiry_date: Optional[str] = None
    issuing_authority: Optional[str] = None
    points: Optional[int] = None
    status: Optional[str] = None


class DriverLicenseResponse(DriverLicenseBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class DriverLicenseListResponse(BaseModel):
    items: List[DriverLicenseResponse]


class VehicleBase(BaseModel):
    citizen_id: str
    license_plate: str
    vehicle_type: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    frame_number: Optional[str] = None
    engine_number: Optional[str] = None
    registration_date: Optional[str] = None
    registration_expiry_date: Optional[str] = None
    issuing_authority: Optional[str] = None
    registration_status: str = "Hoạt động"


class VehicleCreateRequest(VehicleBase):
    pass


class VehicleUpdateRequest(BaseModel):
    license_plate: Optional[str] = None
    vehicle_type: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    frame_number: Optional[str] = None
    engine_number: Optional[str] = None
    registration_date: Optional[str] = None
    registration_expiry_date: Optional[str] = None
    issuing_authority: Optional[str] = None
    registration_status: Optional[str] = None


class VehicleResponse(VehicleBase):
    id: str
    registered_at: Optional[str] = None


class VehicleListResponse(BaseModel):
    items: List[VehicleResponse]


class CitizenCheckRequest(BaseModel):
    citizen_id: str


class CitizenCheckResponse(BaseModel):
    exists: bool
    message: str
