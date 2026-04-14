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
    violation_penalties_table: str
    model_path: str
    encryption_key: str
    paypal_client_id: str
    paypal_client_secret: str
    paypal_base_url: str
    paypal_return_url: str
    paypal_cancel_url: str


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
    violation_penalties_table = os.getenv("SUPABASE_VIOLATION_PENALTIES_TABLE", "violation_penalties").strip()

    if not supabase_url or not supabase_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_SECRET)")

    raw_model_path = os.getenv("YOLO_MODEL_PATH", "models/ver2.pt").strip()
    model_path = _resolve_model_path(server_root, raw_model_path)

    encryption_key = os.getenv("ENCRYPTION_KEY", "default_unsafe_key_change_in_production").strip()
    if encryption_key == "default_unsafe_key_change_in_production":
        print("WARNING: Using default ENCRYPTION_KEY. Set ENCRYPTION_KEY in .env for production.")

    paypal_client_id = os.getenv("PAYPAL_CLIENT_ID", "").strip()
    paypal_client_secret = os.getenv("PAYPAL_CLIENT_SECRET", "").strip()
    paypal_base_url = os.getenv(
        "PAYPAL_BASE_URL",
        "https://api-m.sandbox.paypal.com",
    ).strip()
    paypal_return_url = os.getenv(
        "PAYPAL_RETURN_URL",
        "https://example.com/api/v1/paypal/return",
    ).strip()
    paypal_cancel_url = os.getenv(
        "PAYPAL_CANCEL_URL",
        "https://example.com/api/v1/paypal/cancel",
    ).strip()

    return AppSettings(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        storage_bucket=storage_bucket,
        violations_table=violations_table,
        violation_penalties_table=violation_penalties_table,
        model_path=model_path,
        encryption_key=encryption_key,
        paypal_client_id=paypal_client_id,
        paypal_client_secret=paypal_client_secret,
        paypal_base_url=paypal_base_url,
        paypal_return_url=paypal_return_url,
        paypal_cancel_url=paypal_cancel_url,
    )
