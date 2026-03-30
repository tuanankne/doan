from __future__ import annotations

import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client

from app.services.supabase_service import SupabaseStorageService
from app.services.video_processor import ProcessingConfig, VideoProcessor


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class ProcessVideoResponse(BaseModel):
    total_violations: int
    violations: List[Dict[str, Any]]


class UploadImageResponse(BaseModel):
    file_name: str
    storage_url: str


def build_app() -> FastAPI:
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

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_SECRET", "").strip()
    )
    storage_bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "violations").strip()
    violations_table = os.getenv("SUPABASE_VIOLATIONS_TABLE", "violations").strip()

    if not supabase_url or not supabase_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_SECRET)")

    supabase_client: Client = create_client(supabase_url, supabase_key)
    storage_service = SupabaseStorageService(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        bucket=storage_bucket,
        client=supabase_client,
    )
    storage_service.ensure_bucket_exists(public=True)

    server_root = Path(__file__).resolve().parent.parent

    raw_model_path = os.getenv("YOLO_MODEL_PATH", "models/ver2.pt").strip()
    model_candidate = Path(raw_model_path)
    model_candidates = []

    if model_candidate.is_absolute():
        model_candidates.append(model_candidate)
    else:
        model_candidates.append((server_root / model_candidate).resolve())
        model_candidates.append((server_root.parent / model_candidate).resolve())

    model_path = None
    for candidate in model_candidates:
        if candidate.exists():
            model_path = str(candidate)
            break

    if model_path is None:
        raise RuntimeError(
            "YOLO model not found. Set YOLO_MODEL_PATH to an existing file, e.g. models/ver2.pt"
        )

    @app.get("/health")
    def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/v1/process-video", response_model=ProcessVideoResponse)
    async def process_video(
        video: UploadFile = File(...),
        config: str = Form(...),
    ) -> ProcessVideoResponse:
        suffix = Path(video.filename or "upload.mp4").suffix or ".mp4"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_path = temp_file.name

        try:
            file_bytes = await video.read()
            if not file_bytes:
                raise HTTPException(status_code=400, detail="Uploaded video is empty")

            temp_file.write(file_bytes)
            temp_file.flush()
            temp_file.close()

            try:
                config_data = json.loads(config)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid config JSON: {exc}") from exc

            try:
                processing_config = ProcessingConfig.from_dict(config_data)
            except (KeyError, TypeError, ValueError) as exc:
                raise HTTPException(status_code=400, detail=f"Invalid processing config: {exc}") from exc

            processor = VideoProcessor(
                model_path=model_path,
                storage_bucket=storage_bucket,
                violations_table=violations_table,
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
                temp_file.close()
            except Exception:
                pass
            try:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
            except Exception:
                pass

    @app.post("/api/v1/storage/upload-image", response_model=UploadImageResponse)
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

    return app


app = build_app()
