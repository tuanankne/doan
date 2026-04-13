from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client, create_client

from app.api.management_routes import create_management_router
from app.core.encryption import init_encryption
from app.core.settings import load_settings
from app.schemas.api_models import (
    ConfirmViolationsRequest,
    ConfirmViolationsResponse,
    ProcessVideoResponse,
    ViolationListResponse,
    ViolationRecordResponse,
    ViolationPenaltyCreateRequest,
    ViolationPenaltyListResponse,
    ViolationPenaltyResponse,
    ViolationPenaltyUpdateRequest,
    UploadImageResponse,
)
from app.services.supabase_service import SupabaseStorageService
from app.services.video_processor import ProcessingConfig, VideoProcessor


logger = logging.getLogger(__name__)


def build_app() -> FastAPI:
    settings = load_settings()

    app = FastAPI(
        title="Traffic Violation AI API",
        version="1.0.0",
        description="FastAPI backend for red-light and wrong-way violation detection",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    supabase_client: Client = create_client(settings.supabase_url, settings.supabase_key)
    storage_service = SupabaseStorageService(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_key,
        bucket=settings.storage_bucket,
        client=supabase_client,
    )
    storage_service.ensure_bucket_exists(public=True)

    router = APIRouter(prefix="/api/v1")

    @app.get("/health")
    def health() -> Dict[str, str]:
        return {"status": "ok"}

    @router.post("/process-video", response_model=ProcessVideoResponse)
    async def process_video(
        video: UploadFile = File(...),
        config: str = Form(...),
    ) -> ProcessVideoResponse:
        suffix = Path(video.filename or "upload.mp4").suffix or ".mp4"
        temp_path = ""

        try:
            file_bytes = await video.read()
            if not file_bytes:
                raise HTTPException(status_code=400, detail="Uploaded video is empty")

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(file_bytes)
                temp_path = temp_file.name

            try:
                config_data = json.loads(config)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid config JSON: {exc}") from exc

            try:
                processing_config = ProcessingConfig.from_dict(config_data)
            except (KeyError, TypeError, ValueError) as exc:
                raise HTTPException(status_code=400, detail=f"Invalid processing config: {exc}") from exc

            processor = VideoProcessor(
                model_path=settings.model_path,
                storage_bucket=settings.storage_bucket,
                violations_table=settings.violations_table,
                violation_penalties_table=settings.violation_penalties_table,
                supabase_client=supabase_client,
            )
            violations = processor.process_video(temp_path, processing_config)

            return ProcessVideoResponse(
                total_violations=len(violations),
                violations=violations,
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Processing video failed")
            raise HTTPException(status_code=500, detail=f"Processing failed: {exc}") from exc
        finally:
            try:
                if temp_path and os.path.exists(temp_path):
                    os.unlink(temp_path)
            except Exception:
                pass

    @router.post("/storage/upload-image", response_model=UploadImageResponse)
    async def upload_image_to_storage(
        image: UploadFile = File(...),
        folder: str = Form("manual"),
    ) -> UploadImageResponse:
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded image is empty")

        content_type = image.content_type or "image/jpeg"
        now = datetime.now(timezone.utc)
        file_name = image.filename or f"{uuid.uuid4().hex}.jpg"
        storage_path = f"{folder}/{now.strftime('%Y/%m/%d')}/{uuid.uuid4().hex}_{file_name}"

        try:
            public_url = storage_service.upload_bytes(
                data=image_bytes,
                storage_path=storage_path,
                content_type=content_type,
                upsert=False,
            )
            return UploadImageResponse(file_name=file_name, storage_url=public_url)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc

    @router.post("/confirm-violations", response_model=ConfirmViolationsResponse)
    async def confirm_violations(payload: ConfirmViolationsRequest) -> ConfirmViolationsResponse:
        if not payload.violations:
            raise HTTPException(status_code=400, detail="Danh sách vi phạm xác nhận đang trống")

        try:
            processor = VideoProcessor(
                model_path=settings.model_path,
                storage_bucket=settings.storage_bucket,
                violations_table=settings.violations_table,
                violation_penalties_table=settings.violation_penalties_table,
                supabase_client=supabase_client,
            )
            saved_count = processor.save_confirmed_violations(payload.violations)
            return ConfirmViolationsResponse(saved_count=saved_count)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Lưu vi phạm thất bại: {exc}") from exc

    @router.get("/violations", response_model=ViolationListResponse)
    async def list_violations() -> ViolationListResponse:
        try:
            def canonical_plate(value: str) -> str:
                return re.sub(r"[^A-Z0-9]", "", (value or "").upper())

            def safe_decrypt(value: Any) -> str:
                from app.core.encryption import decrypt_field

                text = str(value or "").strip()
                if not text:
                    return ""
                try:
                    return decrypt_field(text)
                except Exception:
                    return text

            response = (
                supabase_client.table(settings.violations_table)
                .select("id, vehicle_id, detected_license_plate, violation_code, violation_type, fine_amount_snapshot, evidence_image_url, evidence_plate_url, detected_at, status, vehicle_type")
                .order("detected_at", desc=True)
                .limit(200)
                .execute()
            )
            rows = getattr(response, "data", None) or []
            items = []

            for row in rows:
                vehicle_row = None
                vehicle_id = row.get("vehicle_id")
                detected_plate = str(row.get("detected_license_plate", "")).strip()
                canonical = canonical_plate(detected_plate)

                if vehicle_id:
                    for select_fields in (
                        "id, license_plate, citizen_id, vehicle_type, brand, color, frame_number, engine_number, registration_date, registration_expiry_date, issuing_authority, registration_status",
                        "id, license_plate, profile_id, vehicle_type, brand, color, frame_number, engine_number, registration_date, registration_expiry_date, issuing_authority, registration_status",
                    ):
                        try:
                            vehicle_response = (
                                supabase_client.table("vehicles")
                                .select(select_fields)
                                .eq("id", vehicle_id)
                                .limit(1)
                                .execute()
                            )
                            vehicle_rows = getattr(vehicle_response, "data", None) or []
                            vehicle_row = vehicle_rows[0] if vehicle_rows else None
                            if vehicle_row is not None:
                                break
                        except Exception:
                            continue

                if vehicle_row is None and detected_plate:
                    for select_fields in (
                        "id, license_plate, citizen_id, vehicle_type, brand, color, frame_number, engine_number, registration_date, registration_expiry_date, issuing_authority, registration_status",
                        "id, license_plate, profile_id, vehicle_type, brand, color, frame_number, engine_number, registration_date, registration_expiry_date, issuing_authority, registration_status",
                    ):
                        try:
                            vehicle_response = (
                                supabase_client.table("vehicles")
                                .select(select_fields)
                                .ilike("license_plate", f"%{canonical}%")
                                .limit(20)
                                .execute()
                            )
                            vehicle_rows = getattr(vehicle_response, "data", None) or []
                            for candidate in vehicle_rows:
                                if canonical_plate(str(candidate.get("license_plate", ""))) == canonical:
                                    vehicle_row = candidate
                                    break
                            if vehicle_row is not None:
                                break
                        except Exception:
                            continue

                if vehicle_row is None and canonical:
                    for select_fields in (
                        "id, license_plate, citizen_id, vehicle_type, brand, color, frame_number, engine_number, registration_date, registration_expiry_date, issuing_authority, registration_status",
                        "id, license_plate, profile_id, vehicle_type, brand, color, frame_number, engine_number, registration_date, registration_expiry_date, issuing_authority, registration_status",
                    ):
                        try:
                            vehicle_response = (
                                supabase_client.table("vehicles")
                                .select(select_fields)
                                .limit(1000)
                                .execute()
                            )
                            vehicle_rows = getattr(vehicle_response, "data", None) or []
                            for candidate in vehicle_rows:
                                if canonical_plate(str(candidate.get("license_plate", ""))) == canonical:
                                    vehicle_row = candidate
                                    break
                            if vehicle_row is not None:
                                break
                        except Exception:
                            continue

                owner_row: Dict[str, Any] = {}
                citizen_id = str((vehicle_row or {}).get("citizen_id") or "").strip()
                profile_id = str((vehicle_row or {}).get("profile_id") or "").strip()
                if citizen_id:
                    normalized_citizen_id = safe_decrypt(citizen_id)
                    profile_response = (
                        supabase_client.table("profiles")
                        .select("citizen_id, full_name, phone_number, address")
                        .eq("citizen_id", citizen_id)
                        .limit(1)
                        .execute()
                    )
                    profile_rows = getattr(profile_response, "data", None) or []
                    owner_row = profile_rows[0] if profile_rows else {}
                    if not owner_row:
                        # For encrypted citizen_id, compare after decrypting each row.
                        scan_response = (
                            supabase_client.table("profiles")
                            .select("citizen_id, full_name, phone_number, address")
                            .execute()
                        )
                        scan_rows = getattr(scan_response, "data", None) or []
                        for candidate in scan_rows:
                            if safe_decrypt(candidate.get("citizen_id")) == normalized_citizen_id:
                                owner_row = candidate
                                break
                elif profile_id:
                    profile_response = (
                        supabase_client.table("profiles")
                        .select("id, citizen_id, full_name, phone_number, address")
                        .eq("id", profile_id)
                        .limit(1)
                        .execute()
                    )
                    profile_rows = getattr(profile_response, "data", None) or []
                    owner_row = profile_rows[0] if profile_rows else {}
                    citizen_id = str(owner_row.get("citizen_id") or "").strip()

                items.append(
                    ViolationRecordResponse(
                        id=row.get("id"),
                        vehicle_id=vehicle_id,
                        detected_license_plate=detected_plate or "UNKNOWN",
                        violation_code=row.get("violation_code"),
                        violation_type=row.get("violation_type") or "",
                        fine_amount_snapshot=row.get("fine_amount_snapshot"),
                        evidence_image_url=row.get("evidence_image_url") or "",
                        evidence_plate_url=row.get("evidence_plate_url"),
                        detected_at=row.get("detected_at"),
                        status=row.get("status"),
                        vehicle_type=row.get("vehicle_type") or (vehicle_row.get("vehicle_type") if vehicle_row else None),
                        owner_citizen_id=safe_decrypt(owner_row.get("citizen_id") or citizen_id) or None,
                        owner_full_name=safe_decrypt(owner_row.get("full_name")),
                        owner_phone_number=safe_decrypt(owner_row.get("phone_number")),
                        owner_address=owner_row.get("address"),
                        vehicle_brand=vehicle_row.get("brand") if vehicle_row else None,
                        vehicle_color=vehicle_row.get("color") if vehicle_row else None,
                        vehicle_frame_number=vehicle_row.get("frame_number") if vehicle_row else None,
                        vehicle_engine_number=vehicle_row.get("engine_number") if vehicle_row else None,
                        vehicle_registration_date=vehicle_row.get("registration_date") if vehicle_row else None,
                        vehicle_registration_expiry_date=vehicle_row.get("registration_expiry_date") if vehicle_row else None,
                        vehicle_issuing_authority=vehicle_row.get("issuing_authority") if vehicle_row else None,
                        vehicle_registration_status=vehicle_row.get("registration_status") if vehicle_row else None,
                    ).model_dump()
                )

            return ViolationListResponse(items=items)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Không thể tải danh sách vi phạm: {exc}") from exc

    @router.get("/violation-penalties", response_model=ViolationPenaltyListResponse)
    async def list_violation_penalties() -> ViolationPenaltyListResponse:
        try:
            response = (
                supabase_client.table(settings.violation_penalties_table)
                .select("id, violation_code, violation_name, fine_amount, description, is_active, vehicle_type, created_at, updated_at")
                .order("updated_at", desc=True)
                .execute()
            )
            items = getattr(response, "data", None) or []
            return ViolationPenaltyListResponse(items=items)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Không thể tải danh sách mức phạt: {exc}") from exc

    @router.post("/violation-penalties", response_model=ViolationPenaltyResponse)
    async def create_violation_penalty(
        payload: ViolationPenaltyCreateRequest,
    ) -> ViolationPenaltyResponse:
        try:
            response = (
                supabase_client.table(settings.violation_penalties_table)
                .insert(
                    {
                        "violation_code": payload.violation_code.strip(),
                        "violation_name": payload.violation_name.strip(),
                        "fine_amount": payload.fine_amount,
                        "description": payload.description.strip() if payload.description else None,
                        "is_active": payload.is_active,
                        "vehicle_type": payload.vehicle_type.strip() if payload.vehicle_type else None,
                    }
                )
                .execute()
            )
            items = getattr(response, "data", None) or []
            if not items:
                raise RuntimeError("Create penalty returned no data")
            return ViolationPenaltyResponse(**items[0])
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Không thể tạo mức phạt: {exc}") from exc

    @router.put("/violation-penalties/{id}", response_model=ViolationPenaltyResponse)
    async def update_violation_penalty(
        id: str,
        payload: ViolationPenaltyUpdateRequest,
    ) -> ViolationPenaltyResponse:
        update_data = payload.model_dump(exclude_unset=True)
        if "violation_code" in update_data and isinstance(update_data["violation_code"], str):
            update_data["violation_code"] = update_data["violation_code"].strip()
        if "violation_name" in update_data and isinstance(update_data["violation_name"], str):
            update_data["violation_name"] = update_data["violation_name"].strip()
        if "description" in update_data and isinstance(update_data.get("description"), str):
            update_data["description"] = update_data["description"].strip()
        if "vehicle_type" in update_data and isinstance(update_data.get("vehicle_type"), str):
            update_data["vehicle_type"] = update_data["vehicle_type"].strip()

        if not update_data:
            raise HTTPException(status_code=400, detail="Không có dữ liệu để cập nhật")

        try:
            response = (
                supabase_client.table(settings.violation_penalties_table)
                .update(update_data)
                .eq("id", id)
                .execute()
            )
            items = getattr(response, "data", None) or []
            if not items:
                raise HTTPException(status_code=404, detail="Không tìm thấy mức phạt")
            return ViolationPenaltyResponse(**items[0])
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Không thể cập nhật mức phạt: {exc}") from exc

    @router.delete("/violation-penalties/{id}")
    async def delete_violation_penalty(id: str) -> Dict[str, bool]:
        try:
            response = (
                supabase_client.table(settings.violation_penalties_table)
                .delete()
                .eq("id", id)
                .execute()
            )
            items = getattr(response, "data", None) or []
            if not items:
                raise HTTPException(status_code=404, detail="Không tìm thấy mức phạt")
            return {"success": True}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Không thể xóa mức phạt: {exc}") from exc

    app.include_router(router)
    
    # Initialize encryption service
    init_encryption(settings.encryption_key)
    
    # Add management routes
    management_router = create_management_router(supabase_client)
    app.include_router(management_router, prefix="/api/v1")
    
    return app
