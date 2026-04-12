from __future__ import annotations

import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

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
    ViolationPenaltyCreateRequest,
    ViolationPenaltyListResponse,
    ViolationPenaltyResponse,
    ViolationPenaltyUpdateRequest,
    UploadImageResponse,
)
from app.services.supabase_service import SupabaseStorageService
from app.services.video_processor import ProcessingConfig, VideoProcessor


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

    @router.get("/violation-penalties", response_model=ViolationPenaltyListResponse)
    async def list_violation_penalties() -> ViolationPenaltyListResponse:
        try:
            response = (
                supabase_client.table(settings.violation_penalties_table)
                .select("id, violation_code, violation_name, fine_amount, description, is_active, created_at, updated_at")
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
