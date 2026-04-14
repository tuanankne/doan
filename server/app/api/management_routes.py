"""
Management routes for Profiles, Vehicles, and Driver Licenses.
Includes encryption/decryption for sensitive fields.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from supabase import Client

from app.core.encryption import encrypt_field, decrypt_field
from app.core.passwords import hash_secret, verify_secret
from app.schemas.api_models import (
    AccountAdminResetPasswordRequest,
    AccountAuthResponse,
    AccountCheckResponse,
    AccountForgotPasswordRequest,
    AccountLoginRequest,
    AccountRegisterRequest,
    ProfileCreateRequest,
    ProfileUpdateRequest,
    ProfileResponse,
    ProfileResponseWithRelations,
    ProfileListResponse,
    DriverLicenseCreateRequest,
    DriverLicenseUpdateRequest,
    DriverLicenseResponse,
    DriverLicenseListResponse,
    VehicleCreateRequest,
    VehicleUpdateRequest,
    VehicleResponse,
    VehicleListResponse,
    CitizenCheckRequest,
    CitizenCheckResponse,
)


def _safe_decrypt(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        return decrypt_field(text)
    except Exception:
        return text


def _decode_citizen_id(value: str) -> str:
    return _safe_decrypt(value)


def _get_profile_by_citizen_id(supabase_client: Client, citizen_id: str):
    normalized = str(citizen_id or "").strip()
    if not normalized:
        return None

    # Legacy compatibility: old rows may still store citizen_id in plaintext.
    try:
        response = (
            supabase_client.table("profiles")
            .select("id, citizen_id")
            .eq("citizen_id", normalized)
            .limit(1)
            .execute()
        )
        items = getattr(response, "data", None) or []
        if items:
            return items[0]
    except Exception:
        pass

    # Current format uses encrypted citizen_id, so compare by decrypting rows.
    response = supabase_client.table("profiles").select("id, citizen_id").execute()
    items = getattr(response, "data", None) or []
    for item in items:
        if _decode_citizen_id(item.get("citizen_id")) == normalized:
            return item
    return None


def _get_profile_by_id(supabase_client: Client, profile_id: str):
    response = (
        supabase_client.table("profiles")
        .select("id, citizen_id")
        .eq("id", profile_id)
        .limit(1)
        .execute()
    )
    items = getattr(response, "data", None) or []
    return items[0] if items else None


def _get_account_by_profile_id(supabase_client: Client, profile_id: str):
    response = (
        supabase_client.table("accounts")
        .select("id, profile_id, password_hash, reset_hash, status")
        .eq("profile_id", profile_id)
        .limit(1)
        .execute()
    )
    items = getattr(response, "data", None) or []
    return items[0] if items else None


def create_management_router(supabase_client: Client) -> APIRouter:
    """Create management router with profile, vehicle, and driver license endpoints."""
    router = APIRouter(prefix="/management", tags=["Management"])

    # ============== Citizen Check ==============
    @router.post("/check-citizen", response_model=CitizenCheckResponse)
    async def check_citizen(request: CitizenCheckRequest) -> CitizenCheckResponse:
        """Check if a citizen exists in profiles table."""
        try:
            profile = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
            if profile:
                return CitizenCheckResponse(exists=True, message="Citizen found")
            else:
                return CitizenCheckResponse(exists=False, message="Citizen not found")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.post("/check-account", response_model=AccountCheckResponse)
    async def check_account(request: CitizenCheckRequest) -> AccountCheckResponse:
        """Check if citizen has linked account in accounts table."""
        try:
            profile = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
            if not profile:
                return AccountCheckResponse(exists=False, message="Citizen not found")

            account = _get_account_by_profile_id(supabase_client, profile["id"])
            if account:
                return AccountCheckResponse(exists=True, message="Account found")
            return AccountCheckResponse(exists=False, message="Account not found")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.post("/reset-password", response_model=AccountAuthResponse)
    async def admin_reset_password(request: AccountAdminResetPasswordRequest) -> AccountAuthResponse:
        """Admin reset password by citizen_id for account management page."""
        if len(request.new_password.strip()) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")

        try:
            profile = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
            if not profile:
                raise HTTPException(status_code=404, detail="Không tìm thấy công dân")

            account = _get_account_by_profile_id(supabase_client, profile["id"])
            if not account:
                raise HTTPException(status_code=404, detail="Công dân chưa có tài khoản")

            updated = (
                supabase_client.table("accounts")
                .update({"password_hash": hash_secret(request.new_password.strip())})
                .eq("id", account["id"])
                .execute()
            )
            if not getattr(updated, "data", None):
                raise HTTPException(status_code=500, detail="Không thể cập nhật mật khẩu")

            return AccountAuthResponse(
                success=True,
                message="Đặt lại mật khẩu thành công",
                profile_id=profile["id"],
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.post("/auth/register", response_model=AccountAuthResponse)
    async def register_account(request: AccountRegisterRequest) -> AccountAuthResponse:
        """Register account by citizen_id and map to profile_id."""
        citizen_id = request.citizen_id.strip()
        password = request.password.strip()
        confirm_password = request.confirm_password.strip()
        pin = request.pin.strip()

        if not citizen_id:
            raise HTTPException(status_code=400, detail="Citizen ID is required")
        if password != confirm_password:
            raise HTTPException(status_code=400, detail="Mật khẩu xác nhận không khớp")
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 6 ký tự")
        if len(pin) < 4:
            raise HTTPException(status_code=400, detail="Mã PIN phải có ít nhất 4 ký tự")

        try:
            profile = _get_profile_by_citizen_id(supabase_client, citizen_id)
            if not profile:
                raise HTTPException(status_code=404, detail="Không tìm thấy công dân theo CCCD")

            existing = _get_account_by_profile_id(supabase_client, profile["id"])
            if existing:
                raise HTTPException(status_code=400, detail="CCCD này đã liên kết tài khoản")

            result = (
                supabase_client.table("accounts")
                .insert(
                    {
                        "profile_id": profile["id"],
                        "password_hash": hash_secret(password),
                        "reset_hash": hash_secret(pin),
                        "status": "active",
                    }
                )
                .execute()
            )
            if not getattr(result, "data", None):
                raise HTTPException(status_code=500, detail="Không thể tạo tài khoản")

            return AccountAuthResponse(
                success=True,
                message="Đăng ký tài khoản thành công",
                profile_id=profile["id"],
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.post("/auth/login", response_model=AccountAuthResponse)
    async def login_account(request: AccountLoginRequest) -> AccountAuthResponse:
        """Login by citizen_id and password."""
        try:
            profile = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
            if not profile:
                raise HTTPException(status_code=401, detail="CCCD hoặc mật khẩu không đúng")

            account = _get_account_by_profile_id(supabase_client, profile["id"])
            if not account:
                raise HTTPException(status_code=401, detail="CCCD hoặc mật khẩu không đúng")
            if (account.get("status") or "active") != "active":
                raise HTTPException(status_code=403, detail="Tài khoản đang bị khóa")

            if not verify_secret(request.password, str(account.get("password_hash") or "")):
                raise HTTPException(status_code=401, detail="CCCD hoặc mật khẩu không đúng")

            return AccountAuthResponse(
                success=True,
                message="Đăng nhập thành công",
                profile_id=profile["id"],
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.post("/auth/forgot-password", response_model=AccountAuthResponse)
    async def forgot_password(request: AccountForgotPasswordRequest) -> AccountAuthResponse:
        """Reset password by citizen_id and PIN."""
        citizen_id = request.citizen_id.strip()
        pin = request.pin.strip()
        new_password = request.new_password.strip()

        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
        if len(pin) < 4:
            raise HTTPException(status_code=400, detail="Mã PIN không hợp lệ")

        try:
            profile = _get_profile_by_citizen_id(supabase_client, citizen_id)
            if not profile:
                raise HTTPException(status_code=404, detail="Không tìm thấy công dân")

            account = _get_account_by_profile_id(supabase_client, profile["id"])
            if not account:
                raise HTTPException(status_code=404, detail="Công dân chưa có tài khoản")

            if not verify_secret(pin, str(account.get("reset_hash") or "")):
                raise HTTPException(status_code=401, detail="Mã PIN không đúng")

            updated = (
                supabase_client.table("accounts")
                .update({"password_hash": hash_secret(new_password)})
                .eq("id", account["id"])
                .execute()
            )
            if not getattr(updated, "data", None):
                raise HTTPException(status_code=500, detail="Không thể cập nhật mật khẩu")

            return AccountAuthResponse(
                success=True,
                message="Đặt lại mật khẩu thành công",
                profile_id=profile["id"],
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    # ============== Profiles Endpoints ==============
    @router.get("/profiles", response_model=ProfileListResponse)
    async def list_profiles() -> ProfileListResponse:
        """List all profiles with decrypted sensitive fields."""
        try:
            response = supabase_client.table("profiles").select("*").execute()
            accounts = supabase_client.table("accounts").select("profile_id").execute()
            account_profile_ids = {
                str(item.get("profile_id"))
                for item in (getattr(accounts, "data", None) or [])
                if item.get("profile_id")
            }
            profiles = []

            for row in response.data:
                profile = ProfileResponseWithRelations(
                    id=row["id"],
                    full_name=_safe_decrypt(row.get("full_name")),
                    citizen_id=_decode_citizen_id(row.get("citizen_id")),
                    phone_number=decrypt_field(row["phone_number"]) if row.get("phone_number") else "",
                    address=row.get("address"),
                    date_of_birth=row.get("date_of_birth"),
                    created_at=row.get("created_at"),
                    updated_at=row.get("updated_at"),
                    driver_licenses=[],
                    vehicles=[],
                    has_account=str(row.get("id")) in account_profile_ids,
                )

                # Get driver licenses for this profile
                try:
                    licenses_response = (
                        supabase_client.table("driver_licenses")
                        .select("id")
                        .eq("profile_id", row["id"])
                        .execute()
                    )
                    profile.driver_licenses = [lic["id"] for lic in licenses_response.data]
                except Exception:
                    pass

                # Get vehicles for this profile
                try:
                    vehicles_response = (
                        supabase_client.table("vehicles")
                        .select("id")
                        .eq("profile_id", row["id"])
                        .execute()
                    )
                    profile.vehicles = [veh["id"] for veh in vehicles_response.data]
                except Exception:
                    pass

                profiles.append(profile)

            return ProfileListResponse(items=profiles)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.post("/profiles", response_model=ProfileResponse)
    async def create_profile(request: ProfileCreateRequest) -> ProfileResponse:
        """Create a new profile with encrypted sensitive fields."""
        try:
            # Check if citizen_id already exists
            existing = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
            if existing:
                raise HTTPException(status_code=400, detail="Citizen ID already exists")

            encrypted_data = {
                "id": str(uuid.uuid4()),
                "full_name": request.full_name,
                "citizen_id": encrypt_field(request.citizen_id),
                "phone_number": encrypt_field(request.phone_number),
                "address": request.address,
                "date_of_birth": request.date_of_birth,
            }

            response = supabase_client.table("profiles").insert(encrypted_data).execute()
            row = response.data[0]

            return ProfileResponse(
                id=row["id"],
                full_name=_safe_decrypt(row.get("full_name")),
                citizen_id=_decode_citizen_id(row.get("citizen_id")),
                phone_number=decrypt_field(row["phone_number"]),
                address=row.get("address"),
                date_of_birth=row.get("date_of_birth"),
                created_at=row.get("created_at"),
                updated_at=row.get("updated_at"),
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.patch("/profiles/{profile_id}", response_model=ProfileResponse)
    async def update_profile(profile_id: str, request: ProfileUpdateRequest) -> ProfileResponse:
        """Update a profile."""
        try:
            encrypted_data = {}
            if request.full_name:
                encrypted_data["full_name"] = request.full_name
            if request.phone_number:
                encrypted_data["phone_number"] = encrypt_field(request.phone_number)
            if request.address is not None:
                encrypted_data["address"] = request.address
            if request.date_of_birth:
                encrypted_data["date_of_birth"] = request.date_of_birth

            response = supabase_client.table("profiles").update(encrypted_data).eq(
                "id", profile_id
            ).execute()

            if not response.data:
                raise HTTPException(status_code=404, detail="Profile not found")

            row = response.data[0]
            return ProfileResponse(
                id=row["id"],
                full_name=_safe_decrypt(row.get("full_name")),
                citizen_id=_decode_citizen_id(row.get("citizen_id")),
                phone_number=decrypt_field(row["phone_number"]),
                address=row.get("address"),
                date_of_birth=row.get("date_of_birth"),
                created_at=row.get("created_at"),
                updated_at=row.get("updated_at"),
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.delete("/profiles/{profile_id}")
    async def delete_profile(profile_id: str) -> dict:
        """Delete a profile."""
        try:
            supabase_client.table("profiles").delete().eq("id", profile_id).execute()
            return {"message": "Profile deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    # ============== Driver Licenses Endpoints ==============
    @router.get("/driver-licenses", response_model=DriverLicenseListResponse)
    async def list_driver_licenses() -> DriverLicenseListResponse:
        """List all driver licenses with decrypted fields."""
        try:
            response = supabase_client.table("driver_licenses").select("*").execute()
            licenses = []

            for row in response.data:
                profile = _get_profile_by_id(supabase_client, row["profile_id"])
                license_obj = DriverLicenseResponse(
                    id=row["id"],
                    citizen_id=_decode_citizen_id(profile.get("citizen_id")) if profile else "",
                    license_number=decrypt_field(row["license_number"]) if row.get("license_number") else "",
                    license_class=row.get("license_class", ""),
                    issued_date=row.get("issued_date"),
                    expiry_date=row.get("expiry_date"),
                    issuing_authority=row.get("issuing_authority"),
                    points=row.get("points", 12),
                    status=row.get("status", "Hoạt động"),
                    created_at=row.get("created_at"),
                    updated_at=row.get("updated_at"),
                )
                licenses.append(license_obj)

            return DriverLicenseListResponse(items=licenses)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.post("/driver-licenses", response_model=DriverLicenseResponse)
    async def create_driver_license(request: DriverLicenseCreateRequest) -> DriverLicenseResponse:
        """Create a new driver license."""
        try:
            # Check if citizen exists
            profile = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
            if not profile:
                raise HTTPException(status_code=400, detail="Citizen not found in profiles")

            encrypted_data = {
                "profile_id": profile["id"],
                "license_number": encrypt_field(request.license_number),
                "license_class": request.license_class,
                "issued_date": request.issued_date,
                "expiry_date": request.expiry_date,
                "issuing_authority": request.issuing_authority,
                "points": request.points,
                "status": request.status,
            }

            response = supabase_client.table("driver_licenses").insert(encrypted_data).execute()
            row = response.data[0]

            return DriverLicenseResponse(
                id=row["id"],
                citizen_id=request.citizen_id,
                license_number=decrypt_field(row["license_number"]),
                license_class=row.get("license_class", ""),
                issued_date=row.get("issued_date"),
                expiry_date=row.get("expiry_date"),
                issuing_authority=row.get("issuing_authority"),
                points=row.get("points", 12),
                status=row.get("status", "Hoạt động"),
                created_at=row.get("created_at"),
                updated_at=row.get("updated_at"),
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.patch("/driver-licenses/{license_id}", response_model=DriverLicenseResponse)
    async def update_driver_license(
        license_id: str, request: DriverLicenseUpdateRequest
    ) -> DriverLicenseResponse:
        """Update a driver license."""
        try:
            encrypted_data = {}
            if request.license_number:
                encrypted_data["license_number"] = encrypt_field(request.license_number)
            if request.license_class:
                encrypted_data["license_class"] = request.license_class
            if request.issued_date:
                encrypted_data["issued_date"] = request.issued_date
            if request.expiry_date is not None:
                encrypted_data["expiry_date"] = request.expiry_date
            if request.issuing_authority is not None:
                encrypted_data["issuing_authority"] = request.issuing_authority
            if request.points is not None:
                encrypted_data["points"] = request.points
            if request.status:
                encrypted_data["status"] = request.status

            response = supabase_client.table("driver_licenses").update(encrypted_data).eq(
                "id", license_id
            ).execute()

            if not response.data:
                raise HTTPException(status_code=404, detail="Driver license not found")

            row = response.data[0]
            profile = _get_profile_by_id(supabase_client, row["profile_id"])
            return DriverLicenseResponse(
                id=row["id"],
                citizen_id=_decode_citizen_id(profile.get("citizen_id")) if profile else "",
                license_number=decrypt_field(row["license_number"]),
                license_class=row.get("license_class", ""),
                issued_date=row.get("issued_date"),
                expiry_date=row.get("expiry_date"),
                issuing_authority=row.get("issuing_authority"),
                points=row.get("points", 12),
                status=row.get("status", "Hoạt động"),
                created_at=row.get("created_at"),
                updated_at=row.get("updated_at"),
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.delete("/driver-licenses/{license_id}")
    async def delete_driver_license(license_id: str) -> dict:
        """Delete a driver license."""
        try:
            supabase_client.table("driver_licenses").delete().eq("id", license_id).execute()
            return {"message": "Driver license deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    # ============== Vehicles Endpoints ==============
    @router.get("/vehicles", response_model=VehicleListResponse)
    async def list_vehicles() -> VehicleListResponse:
        """List all vehicles."""
        try:
            response = supabase_client.table("vehicles").select("*").execute()
            vehicles = []

            for row in response.data:
                profile = _get_profile_by_id(supabase_client, row["profile_id"])
                vehicle = VehicleResponse(
                    id=row["id"],
                    citizen_id=_decode_citizen_id(profile.get("citizen_id")) if profile else "",
                    license_plate=row.get("license_plate", ""),
                    vehicle_type=row.get("vehicle_type"),
                    brand=row.get("brand"),
                    color=row.get("color"),
                    frame_number=row.get("frame_number"),
                    engine_number=row.get("engine_number"),
                    registration_date=row.get("registration_date"),
                    registration_expiry_date=row.get("registration_expiry_date"),
                    issuing_authority=row.get("issuing_authority"),
                    registration_status=row.get("registration_status", "Hoạt động"),
                    registered_at=row.get("registered_at"),
                )
                vehicles.append(vehicle)

            return VehicleListResponse(items=vehicles)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.post("/vehicles", response_model=VehicleResponse)
    async def create_vehicle(request: VehicleCreateRequest) -> VehicleResponse:
        """Create a new vehicle."""
        try:
            # Check if citizen exists
            profile = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
            if not profile:
                raise HTTPException(status_code=400, detail="Citizen not found in profiles")

            vehicle_data = {
                "profile_id": profile["id"],
                "license_plate": request.license_plate,
                "vehicle_type": request.vehicle_type,
                "brand": request.brand,
                "color": request.color,
                "frame_number": request.frame_number,
                "engine_number": request.engine_number,
                "registration_date": request.registration_date,
                "registration_expiry_date": request.registration_expiry_date,
                "issuing_authority": request.issuing_authority,
                "registration_status": request.registration_status,
            }

            response = supabase_client.table("vehicles").insert(vehicle_data).execute()
            row = response.data[0]

            return VehicleResponse(
                id=row["id"],
                citizen_id=request.citizen_id,
                license_plate=row.get("license_plate", ""),
                vehicle_type=row.get("vehicle_type"),
                brand=row.get("brand"),
                color=row.get("color"),
                frame_number=row.get("frame_number"),
                engine_number=row.get("engine_number"),
                registration_date=row.get("registration_date"),
                registration_expiry_date=row.get("registration_expiry_date"),
                issuing_authority=row.get("issuing_authority"),
                registration_status=row.get("registration_status", "Hoạt động"),
                registered_at=row.get("registered_at"),
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.patch("/vehicles/{vehicle_id}", response_model=VehicleResponse)
    async def update_vehicle(vehicle_id: str, request: VehicleUpdateRequest) -> VehicleResponse:
        """Update a vehicle."""
        try:
            vehicle_data = {}
            if request.citizen_id:
                profile = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
                if not profile:
                    raise HTTPException(status_code=400, detail="Citizen not found in profiles")
                vehicle_data["profile_id"] = profile["id"]
            if request.license_plate:
                vehicle_data["license_plate"] = request.license_plate
            if request.vehicle_type is not None:
                vehicle_data["vehicle_type"] = request.vehicle_type
            if request.brand is not None:
                vehicle_data["brand"] = request.brand
            if request.color is not None:
                vehicle_data["color"] = request.color
            if request.frame_number is not None:
                vehicle_data["frame_number"] = request.frame_number
            if request.engine_number is not None:
                vehicle_data["engine_number"] = request.engine_number
            if request.registration_date is not None:
                vehicle_data["registration_date"] = request.registration_date
            if request.registration_expiry_date is not None:
                vehicle_data["registration_expiry_date"] = request.registration_expiry_date
            if request.issuing_authority is not None:
                vehicle_data["issuing_authority"] = request.issuing_authority
            if request.registration_status:
                vehicle_data["registration_status"] = request.registration_status

            response = supabase_client.table("vehicles").update(vehicle_data).eq(
                "id", vehicle_id
            ).execute()

            if not response.data:
                raise HTTPException(status_code=404, detail="Vehicle not found")

            row = response.data[0]
            profile = _get_profile_by_id(supabase_client, row["profile_id"])
            return VehicleResponse(
                id=row["id"],
                citizen_id=_decode_citizen_id(profile.get("citizen_id")) if profile else "",
                license_plate=row.get("license_plate", ""),
                vehicle_type=row.get("vehicle_type"),
                brand=row.get("brand"),
                color=row.get("color"),
                frame_number=row.get("frame_number"),
                engine_number=row.get("engine_number"),
                registration_date=row.get("registration_date"),
                registration_expiry_date=row.get("registration_expiry_date"),
                issuing_authority=row.get("issuing_authority"),
                registration_status=row.get("registration_status", "Hoạt động"),
                registered_at=row.get("registered_at"),
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.delete("/vehicles/{vehicle_id}")
    async def delete_vehicle(vehicle_id: str) -> dict:
        """Delete a vehicle."""
        try:
            supabase_client.table("vehicles").delete().eq("id", vehicle_id).execute()
            return {"message": "Vehicle deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    # ============== Mobile Documents Endpoints ==============
    @router.post("/documents/driver-licenses", response_model=DriverLicenseListResponse)
    async def get_driver_licenses_by_citizen(request: CitizenCheckRequest) -> DriverLicenseListResponse:
        """Get driver licenses for a citizen by citizen_id."""
        try:
            profile = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
            if not profile:
                return DriverLicenseListResponse(items=[])

            response = (
                supabase_client.table("driver_licenses")
                .select("*")
                .eq("profile_id", profile["id"])
                .execute()
            )
            licenses = []

            for row in response.data:
                license_obj = DriverLicenseResponse(
                    id=row["id"],
                    citizen_id=request.citizen_id,
                    license_number=decrypt_field(row["license_number"]) if row.get("license_number") else "",
                    license_class=row.get("license_class", ""),
                    issued_date=row.get("issued_date"),
                    expiry_date=row.get("expiry_date"),
                    issuing_authority=row.get("issuing_authority"),
                    points=row.get("points", 12),
                    status=row.get("status", "Hoạt động"),
                    created_at=row.get("created_at"),
                    updated_at=row.get("updated_at"),
                )
                licenses.append(license_obj)

            return DriverLicenseListResponse(items=licenses)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    @router.post("/documents/vehicles", response_model=VehicleListResponse)
    async def get_vehicles_by_citizen(request: CitizenCheckRequest) -> VehicleListResponse:
        """Get vehicles for a citizen by citizen_id."""
        try:
            profile = _get_profile_by_citizen_id(supabase_client, request.citizen_id)
            if not profile:
                return VehicleListResponse(items=[])

            response = (
                supabase_client.table("vehicles")
                .select("*")
                .eq("profile_id", profile["id"])
                .execute()
            )
            vehicles = []

            for row in response.data:
                vehicle = VehicleResponse(
                    id=row["id"],
                    citizen_id=request.citizen_id,
                    license_plate=row.get("license_plate", ""),
                    vehicle_type=row.get("vehicle_type"),
                    brand=row.get("brand"),
                    color=row.get("color"),
                    frame_number=row.get("frame_number"),
                    engine_number=row.get("engine_number"),
                    registration_date=row.get("registration_date"),
                    registration_expiry_date=row.get("registration_expiry_date"),
                    issuing_authority=row.get("issuing_authority"),
                    registration_status=row.get("registration_status", "Hoạt động"),
                    registered_at=row.get("registered_at"),
                )
                vehicles.append(vehicle)

            return VehicleListResponse(items=vehicles)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    return router
