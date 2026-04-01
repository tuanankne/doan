from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class AppSettings:
    supabase_url: str
    supabase_key: str
    storage_bucket: str
    violations_table: str
    model_path: str


def _resolve_model_path(server_root: Path, raw_model_path: str) -> str:
    model_candidate = Path(raw_model_path)
    model_candidates = []

    if model_candidate.is_absolute():
        model_candidates.append(model_candidate)
    else:
        model_candidates.append((server_root / model_candidate).resolve())
        model_candidates.append((server_root.parent / model_candidate).resolve())

    for candidate in model_candidates:
        if candidate.exists():
            return str(candidate)

    raise RuntimeError(
        "YOLO model not found. Set YOLO_MODEL_PATH to an existing file, for example models/ver2.pt"
    )


def load_settings() -> AppSettings:
    server_root = Path(__file__).resolve().parents[2]
    load_dotenv(server_root / ".env")

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_SECRET", "").strip()
    )
    storage_bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "violations").strip()
    violations_table = os.getenv("SUPABASE_VIOLATIONS_TABLE", "violations").strip()

    if not supabase_url or not supabase_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_SECRET)")

    raw_model_path = os.getenv("YOLO_MODEL_PATH", "models/ver2.pt").strip()
    model_path = _resolve_model_path(server_root, raw_model_path)

    return AppSettings(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        storage_bucket=storage_bucket,
        violations_table=violations_table,
        model_path=model_path,
    )
